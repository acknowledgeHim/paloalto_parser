import 'dart:io';

import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:photo_manager/photo_manager.dart';

import 'paths.dart';

enum Source { media, folder }

enum MediaKind { photos, videos, both }

class Criteria {
  Source source;
  MediaKind kind;
  DateTime? from;
  DateTime? to;
  String extensions; // "pdf, docx" — empty = any
  String nameContains;
  String? folder; // for Source.folder; null = default root
  bool includeHidden;

  Criteria({
    this.source = Source.media,
    this.kind = MediaKind.both,
    this.from,
    this.to,
    this.extensions = '',
    this.nameContains = '',
    this.folder,
    this.includeHidden = false,
  });
}

/// One thing on the phone that can be sent: a photo/video from the gallery
/// or a plain file.
class LocalItem {
  final String id;
  final String name;
  final DateTime date;
  final int size; // -1 = not known yet (gallery items)
  final AssetEntity? asset;
  final String? path;

  LocalItem.asset(AssetEntity a, this.name)
      : asset = a,
        path = null,
        id = 'asset:${a.id}',
        date = a.createDateTime,
        size = -1;

  LocalItem.file(File f, FileStat st)
      : asset = null,
        path = f.path,
        id = 'file:${f.path}',
        name = p.basename(f.path),
        date = st.modified,
        size = st.size;

  bool get isAsset => asset != null;
  bool get isVideo => asset?.type == AssetType.video;

  /// The original, full-quality file. For gallery items on iPhone this may be
  /// a temporary export made by the system.
  Future<File?> file() async => asset != null ? asset!.originFile : File(path!);
}

class ScanException implements Exception {
  final String message;
  final bool openSettings;
  ScanException(this.message, {this.openSettings = false});
  @override
  String toString() => message;
}

class Scanner {
  /// Where "Files" searches start when no folder was chosen.
  static Future<String> defaultRoot() async {
    if (Platform.isAndroid) return '/storage/emulated/0';
    return (await getApplicationDocumentsDirectory()).path;
  }

  static Future<List<LocalItem>> scan(
    Criteria c, {
    void Function(int found, String where)? onProgress,
    bool Function()? cancelled,
  }) {
    return c.source == Source.media
        ? _scanMedia(c, onProgress, cancelled)
        : _scanFolder(c, onProgress, cancelled);
  }

  static Future<List<LocalItem>> _scanMedia(
    Criteria c,
    void Function(int, String)? onProgress,
    bool Function()? cancelled,
  ) async {
    final ps = await PhotoManager.requestPermissionExtend();
    if (!ps.hasAccess) {
      throw ScanException('Photo access was not allowed.', openSettings: true);
    }
    if (Platform.isAndroid) {
      // Without this Android strips GPS location out of the originals.
      await Permission.accessMediaLocation.request();
    }

    final filter = FilterOptionGroup(
      createTimeCond: DateTimeCond(
        min: c.from == null ? DateTime(1970) : dayStart(c.from!),
        max: c.to == null
            ? DateTime.now().add(const Duration(days: 1))
            : dayEnd(c.to!),
      ),
      orders: [const OrderOption(type: OrderOptionType.createDate, asc: false)],
    );
    final type = switch (c.kind) {
      MediaKind.photos => RequestType.image,
      MediaKind.videos => RequestType.video,
      MediaKind.both => RequestType.common,
    };

    final exts = parseExtensions(c.extensions);
    final needle = c.nameContains.trim().toLowerCase();
    final total =
        await PhotoManager.getAssetCount(filterOption: filter, type: type);
    final out = <LocalItem>[];
    const page = 500;
    for (var start = 0; start < total; start += page) {
      if (cancelled?.call() ?? false) break;
      final end = (start + page) > total ? total : start + page;
      final batch = await PhotoManager.getAssetListRange(
          start: start, end: end, filterOption: filter, type: type);
      for (final a in batch) {
        var name = a.title ?? '';
        if (name.isEmpty || exts.isNotEmpty || needle.isNotEmpty) {
          name = await a.titleAsync;
        }
        if (name.isEmpty) name = 'media_${a.id.replaceAll('/', '_')}';
        if (!matchesExtensions(name, exts)) continue;
        if (needle.isNotEmpty && !name.toLowerCase().contains(needle)) continue;
        out.add(LocalItem.asset(a, name));
      }
      onProgress?.call(out.length, 'Gallery: $end of $total checked');
    }
    return out;
  }

  static Future<void> _ensureFileAccess() async {
    if (!Platform.isAndroid) return;
    // Android 11+: "All files access" (needed for PDFs, Downloads, etc.)
    final all = await Permission.manageExternalStorage.status;
    if (all.isGranted) return;
    final r = await Permission.manageExternalStorage.request();
    if (r.isGranted) return;
    // Android 10 and older use the classic storage permission.
    final st = await Permission.storage.request();
    if (st.isGranted) return;
    throw ScanException(
        'File access was not allowed. Turn on "Allow access to manage all files" for SMB Sync.',
        openSettings: true);
  }

  static Future<List<LocalItem>> _scanFolder(
    Criteria c,
    void Function(int, String)? onProgress,
    bool Function()? cancelled,
  ) async {
    await _ensureFileAccess();
    final root = c.folder ?? await defaultRoot();
    final exts = parseExtensions(c.extensions);
    final needle = c.nameContains.trim().toLowerCase();
    final out = <LocalItem>[];
    final pending = <Directory>[Directory(root)];
    var dirs = 0;

    while (pending.isNotEmpty) {
      if (cancelled?.call() ?? false) break;
      final dir = pending.removeLast();
      dirs++;
      if (dirs % 20 == 0) onProgress?.call(out.length, dir.path);
      List<FileSystemEntity> entries;
      try {
        entries = await dir.list(followLinks: false).toList();
      } catch (_) {
        continue; // unreadable folder (e.g. Android/data) — skip it
      }
      for (final e in entries) {
        final name = p.basename(e.path);
        if (!c.includeHidden && name.startsWith('.')) continue;
        if (e is Directory) {
          if (_skipDir(e.path)) continue;
          pending.add(e);
        } else if (e is File) {
          if (!matchesExtensions(name, exts)) continue;
          if (needle.isNotEmpty && !name.toLowerCase().contains(needle)) {
            continue;
          }
          FileStat st;
          try {
            st = await e.stat();
          } catch (_) {
            continue;
          }
          if (!inRange(st.modified, c.from, c.to)) continue;
          out.add(LocalItem.file(e, st));
        }
      }
    }
    out.sort((a, b) => b.date.compareTo(a.date));
    onProgress?.call(out.length, 'Done');
    return out;
  }

  static bool _skipDir(String path) {
    final n = path.replaceAll('\\', '/');
    return n.endsWith('/Android/data') || n.endsWith('/Android/obb');
  }
}
