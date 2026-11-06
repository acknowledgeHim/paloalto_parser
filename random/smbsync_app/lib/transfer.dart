import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:photo_manager/photo_manager.dart';
import 'package:wakelock_plus/wakelock_plus.dart';

import 'config.dart';
import 'paths.dart';
import 'scanner.dart';
import 'smb_service.dart';

enum ItemState { waiting, sending, sent, alreadyThere, failed, deleted, notDeleted }

/// Runs one Copy or Move. Nothing is removed from the phone unless the same
/// file (same size) is confirmed on the share first.
class TransferJob extends ChangeNotifier {
  final ShareConfig cfg;
  final List<LocalItem> items;
  final bool move;

  TransferJob({required this.cfg, required this.items, required this.move})
      : states = List.filled(items.length, ItemState.waiting),
        errors = List.filled(items.length, null);

  final List<ItemState> states;
  final List<String?> errors;
  int index = 0;
  int currentBytes = 0;
  int currentSize = 0;
  int bytesTotal = 0;
  String status = 'Connecting…';
  bool running = false;
  bool finished = false;
  bool _cancel = false;

  int count(ItemState s) => states.where((e) => e == s).length;
  int get sentCount => count(ItemState.sent);
  int get alreadyCount => count(ItemState.alreadyThere);
  int get failedCount => count(ItemState.failed);
  int get deletedCount => count(ItemState.deleted);
  int get notDeletedCount => count(ItemState.notDeleted);
  int get processed => states.where((s) => s != ItemState.waiting && s != ItemState.sending).length;

  bool _disposed = false;

  @override
  void notifyListeners() {
    if (!_disposed) super.notifyListeners();
  }

  @override
  void dispose() {
    _disposed = true;
    super.dispose();
  }

  void cancel() {
    _cancel = true;
    status = 'Stopping after this file…';
    notifyListeners();
  }

  Future<void> run() async {
    if (running) return;
    running = true;
    notifyListeners();
    await WakelockPlus.enable().catchError((_) {});
    final smb = SmbService(cfg);
    final safe = <int>[]; // indexes confirmed on the share
    try {
      await smb.connect();
      for (index = 0; index < items.length; index++) {
        if (_cancel) break;
        final ok = await _sendOne(smb, index);
        if (ok) safe.add(index);
      }
      await smb.close();

      if (move && safe.isNotEmpty) {
        status = 'Removing ${safe.length} confirmed file(s) from the phone…';
        notifyListeners();
        await _deleteFromPhone(safe);
      }

      if (items.any((i) => i.isAsset) && safe.isNotEmpty) {
        await SyncState.setLastMediaSync(DateTime.now());
      }
      status = _cancel ? 'Stopped' : 'Finished';
    } catch (e) {
      status = 'Stopped: $e';
    } finally {
      await smb.close();
      if (items.any((i) => i.isAsset)) {
        // Temporary exports made while reading gallery originals.
        await PhotoManager.clearFileCache().catchError((_) {});
      }
      await WakelockPlus.disable().catchError((_) {});
      running = false;
      finished = true;
      notifyListeners();
    }
  }

  Future<bool> _sendOne(SmbService smb, int i) async {
    final item = items[i];
    states[i] = ItemState.sending;
    currentBytes = 0;
    currentSize = item.size;
    status = 'Sending ${item.name}';
    notifyListeners();

    final dir = joinRemote(
        [cfg.share, cfg.folder, datedSubfolder(item.date, cfg.subfolders)]);
    final name = safeName(item.name);

    for (var attempt = 1; attempt <= 2; attempt++) {
      try {
        final f = await item.file();
        if (f == null || !await f.exists()) {
          throw 'Could not read the file on the phone';
        }
        currentSize = await f.length();
        var last = DateTime.now();
        final r = await smb.upload(f, dir, name, (sent) {
          currentBytes = sent;
          final now = DateTime.now();
          if (now.difference(last).inMilliseconds > 150) {
            last = now;
            notifyListeners();
          }
        });
        bytesTotal += currentSize;
        states[i] = r.outcome == UploadOutcome.alreadyThere
            ? ItemState.alreadyThere
            : ItemState.sent;
        errors[i] = null;
        notifyListeners();
        return true;
      } catch (e) {
        errors[i] = '$e';
        if (attempt == 1) {
          // Wi-Fi blip or dropped session: reconnect and try once more.
          status = 'Problem with ${item.name}, reconnecting…';
          notifyListeners();
          try {
            await smb.connect();
          } catch (_) {}
        }
      }
    }
    states[i] = ItemState.failed;
    notifyListeners();
    return false;
  }

  Future<void> _deleteFromPhone(List<int> safe) async {
    final assetIdx = safe.where((i) => items[i].isAsset).toList();
    final fileIdx = safe.where((i) => !items[i].isAsset).toList();

    for (final i in fileIdx) {
      try {
        await File(items[i].path!).delete();
        states[i] = ItemState.deleted;
      } catch (e) {
        states[i] = ItemState.notDeleted;
        errors[i] = 'Copied, but could not remove from phone: $e';
      }
    }
    notifyListeners();

    // Gallery items: the system may show one "Allow delete?" prompt per batch
    // (iPhone always does; Android unless "delete without asking" is on).
    const batchSize = 300;
    for (var b = 0; b < assetIdx.length; b += batchSize) {
      final chunk = assetIdx.sublist(
          b, (b + batchSize) > assetIdx.length ? assetIdx.length : b + batchSize);
      final ids = chunk.map((i) => items[i].asset!.id).toList();
      List<String> gone = const [];
      try {
        gone = await PhotoManager.editor.deleteWithIds(ids);
      } catch (e) {
        for (final i in chunk) {
          errors[i] = 'Copied, but could not remove from phone: $e';
        }
      }
      final goneSet = gone.toSet();
      for (final i in chunk) {
        if (goneSet.contains(items[i].asset!.id)) {
          states[i] = ItemState.deleted;
        } else {
          states[i] = ItemState.notDeleted;
          errors[i] ??= 'Copied, but removal was declined or failed — it is still on the phone';
        }
      }
      notifyListeners();
    }
  }
}
