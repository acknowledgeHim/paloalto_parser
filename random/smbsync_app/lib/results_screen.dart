import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:photo_manager/photo_manager.dart';

import 'config.dart';
import 'paths.dart';
import 'scanner.dart';
import 'transfer_screen.dart';

/// Shows what the search found; everything starts selected.
class ResultsScreen extends StatefulWidget {
  final ShareConfig cfg;
  final Criteria criteria;
  const ResultsScreen({super.key, required this.cfg, required this.criteria});

  @override
  State<ResultsScreen> createState() => _ResultsScreenState();
}

class _ResultsScreenState extends State<ResultsScreen> {
  List<LocalItem> items = [];
  final Set<String> selected = {};
  bool scanning = true;
  bool _stop = false;
  String progress = 'Searching…';
  String? error;
  bool errorSettings = false;
  bool didTransfer = false;

  @override
  void initState() {
    super.initState();
    _scan();
  }

  @override
  void dispose() {
    _stop = true;
    super.dispose();
  }

  Future<void> _scan() async {
    try {
      final found = await Scanner.scan(
        widget.criteria,
        cancelled: () => _stop,
        onProgress: (n, where) {
          if (mounted) setState(() => progress = '$n found · $where');
        },
      );
      if (!mounted) return;
      setState(() {
        items = found;
        selected
          ..clear()
          ..addAll(found.map((e) => e.id));
      });
    } on ScanException catch (e) {
      setState(() {
        error = e.message;
        errorSettings = e.openSettings;
      });
    } catch (e) {
      if (mounted) setState(() => error = '$e');
    } finally {
      if (mounted) setState(() => scanning = false);
    }
  }

  List<LocalItem> get chosen => items.where((e) => selected.contains(e.id)).toList();

  int get knownBytes =>
      chosen.where((e) => e.size >= 0).fold(0, (sum, e) => sum + e.size);

  Future<void> _go(bool move) async {
    final list = chosen;
    if (list.isEmpty) return;
    if (move) {
      final ok = await showDialog<bool>(
        context: context,
        builder: (ctx) => AlertDialog(
          title: Text('Move ${list.length} file(s)?'),
          content: Text(
            'Each file is copied to ${widget.cfg.display}, checked on the share '
            '(same size), and only then removed from this phone.\n\n'
            'Files that fail to copy stay on the phone.'
            '${list.any((e) => e.isAsset) ? '\n\nThe phone may ask you to confirm removing the photos/videos. '
                'On iPhone they go to "Recently Deleted" for 30 days.' : ''}',
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
            FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Move')),
          ],
        ),
      );
      if (ok != true) return;
    }
    if (!mounted) return;
    await Navigator.push(
      context,
      MaterialPageRoute(
          builder: (_) => TransferScreen(cfg: widget.cfg, items: list, move: move)),
    );
    didTransfer = true;
    if (!mounted) return;
    if (move) {
      // Removed items are gone — search again so the list is accurate.
      setState(() {
        scanning = true;
        items = [];
        selected.clear();
      });
      _scan();
    }
  }

  @override
  Widget build(BuildContext context) {
    final all = items.isNotEmpty && selected.length == items.length;
    final bytes = knownBytes;
    final hasUnknown = chosen.any((e) => e.size < 0);

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) Navigator.pop(context, didTransfer);
      },
      child: Scaffold(
        appBar: AppBar(
          title: Text(scanning ? 'Searching…' : '${items.length} found'),
          actions: [
            if (items.isNotEmpty)
              TextButton(
                onPressed: () => setState(() {
                  if (all) {
                    selected.clear();
                  } else {
                    selected.addAll(items.map((e) => e.id));
                  }
                }),
                child: Text(all ? 'Select none' : 'Select all'),
              ),
          ],
        ),
        body: _body(),
        bottomNavigationBar: items.isEmpty
            ? null
            : SafeArea(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(12, 8, 12, 12),
                  child: Column(mainAxisSize: MainAxisSize.min, children: [
                    Text(
                        '${selected.length} selected'
                        '${bytes > 0 ? ' · ${formatBytes(bytes)}${hasUnknown ? '+' : ''}' : ''}',
                        style: Theme.of(context).textTheme.bodySmall),
                    const SizedBox(height: 8),
                    Row(children: [
                      Expanded(
                        child: OutlinedButton.icon(
                          onPressed: selected.isEmpty ? null : () => _go(false),
                          icon: const Icon(Icons.copy),
                          label: const Text('Copy'),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: FilledButton.icon(
                          onPressed: selected.isEmpty ? null : () => _go(true),
                          icon: const Icon(Icons.drive_file_move_outline),
                          label: const Text('Move'),
                        ),
                      ),
                    ]),
                  ]),
                ),
              ),
      ),
    );
  }

  Widget _body() {
    if (scanning) {
      return Center(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          const CircularProgressIndicator(),
          const SizedBox(height: 16),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 24),
            child: Text(progress, textAlign: TextAlign.center, maxLines: 3),
          ),
          TextButton(onPressed: () => _stop = true, child: const Text('Stop searching')),
        ]),
      );
    }
    if (error != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            Text(error!, textAlign: TextAlign.center),
            if (errorSettings)
              TextButton(onPressed: () => openAppSettings(), child: const Text('Open Settings')),
          ]),
        ),
      );
    }
    if (items.isEmpty) return const Center(child: Text('Nothing matched.'));
    return ListView.builder(
      itemCount: items.length,
      itemBuilder: (_, i) {
        final it = items[i];
        final on = selected.contains(it.id);
        return CheckboxListTile(
          value: on,
          onChanged: (v) => setState(() => v == true ? selected.add(it.id) : selected.remove(it.id)),
          secondary: _Thumb(item: it),
          title: Text(it.name, maxLines: 1, overflow: TextOverflow.ellipsis),
          subtitle: Text(
            [
              formatDate(it.date),
              if (it.size >= 0) formatBytes(it.size),
              if (it.path != null) it.path!,
            ].join(' · '),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
          dense: true,
        );
      },
    );
  }
}

class _Thumb extends StatefulWidget {
  final LocalItem item;
  const _Thumb({required this.item});

  @override
  State<_Thumb> createState() => _ThumbState();
}

class _ThumbState extends State<_Thumb> {
  Future<Uint8List?>? _data;

  @override
  void initState() {
    super.initState();
    final a = widget.item.asset;
    if (a != null) _data = a.thumbnailDataWithSize(const ThumbnailSize.square(120));
  }

  @override
  Widget build(BuildContext context) {
    const size = 48.0;
    if (_data == null) {
      final ext = extensionOf(widget.item.name);
      return SizedBox(
        width: size,
        height: size,
        child: Icon(switch (ext) {
          'pdf' => Icons.picture_as_pdf_outlined,
          'jpg' || 'jpeg' || 'png' || 'heic' || 'gif' || 'webp' => Icons.image_outlined,
          'mp4' || 'mov' || 'mkv' || '3gp' => Icons.movie_outlined,
          'mp3' || 'm4a' || 'flac' || 'wav' => Icons.music_note_outlined,
          'zip' || 'rar' || '7z' => Icons.archive_outlined,
          _ => Icons.insert_drive_file_outlined,
        }),
      );
    }
    return FutureBuilder<Uint8List?>(
      future: _data,
      builder: (_, snap) => ClipRRect(
        borderRadius: BorderRadius.circular(6),
        child: SizedBox(
          width: size,
          height: size,
          child: snap.data == null
              ? const ColoredBox(color: Color(0x22888888))
              : Stack(fit: StackFit.expand, children: [
                  Image.memory(snap.data!, fit: BoxFit.cover, gaplessPlayback: true),
                  if (widget.item.isVideo)
                    const Center(child: Icon(Icons.play_circle_fill, color: Colors.white70, size: 20)),
                ]),
        ),
      ),
    );
  }
}
