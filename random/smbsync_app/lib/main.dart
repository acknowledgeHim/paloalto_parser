import 'dart:io';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:permission_handler/permission_handler.dart';

import 'config.dart';
import 'paths.dart';
import 'results_screen.dart';
import 'scanner.dart';
import 'settings_screen.dart';

void main() => runApp(const SmbSyncApp());

class SmbSyncApp extends StatelessWidget {
  const SmbSyncApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'SMB Sync',
      theme: ThemeData(colorSchemeSeed: Colors.teal, useMaterial3: true),
      darkTheme: ThemeData(
          colorSchemeSeed: Colors.teal, brightness: Brightness.dark, useMaterial3: true),
      home: const HomeScreen(),
    );
  }
}

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  ShareConfig? cfg;
  DateTime? lastSync;
  final crit = Criteria();
  final _exts = TextEditingController();
  final _name = TextEditingController();
  String? _defaultRoot;

  static const _presets = <String, String>{
    'PDF': 'pdf',
    'Documents': 'pdf doc docx xls xlsx ppt pptx txt rtf odt csv',
    'Pictures': 'jpg jpeg png heic heif gif webp dng raw',
    'Videos': 'mp4 mov m4v 3gp mkv avi webm',
    'Music': 'mp3 m4a aac flac wav ogg',
    'Archives': 'zip rar 7z tar gz',
  };

  @override
  void initState() {
    super.initState();
    _init();
  }

  Future<void> _init() async {
    final c = await ShareConfig.load();
    final ls = await SyncState.lastMediaSync();
    final root = await Scanner.defaultRoot();
    setState(() {
      cfg = c;
      lastSync = ls;
      _defaultRoot = root;
    });
  }

  Future<void> _openSettings() async {
    final updated = await Navigator.push<ShareConfig>(
        context, MaterialPageRoute(builder: (_) => SettingsScreen(cfg: cfg!)));
    if (updated != null) setState(() => cfg = updated);
  }

  Future<void> _pickDate(bool from) async {
    final now = DateTime.now();
    final d = await showDatePicker(
      context: context,
      firstDate: DateTime(1990),
      lastDate: DateTime(now.year + 1),
      initialDate: (from ? crit.from : crit.to) ?? now,
    );
    if (d == null) return;
    setState(() {
      if (from) {
        crit.from = d;
      } else {
        crit.to = d;
      }
    });
  }

  Future<void> _pickRange() async {
    final now = DateTime.now();
    final r = await showDateRangePicker(
      context: context,
      firstDate: DateTime(1990),
      lastDate: DateTime(now.year + 1),
      initialDateRange: crit.from != null && crit.to != null
          ? DateTimeRange(start: crit.from!, end: crit.to!)
          : null,
    );
    if (r != null) {
      setState(() {
        crit.from = r.start;
        crit.to = r.end;
      });
    }
  }

  Future<void> _pickFolder() async {
    final dir = await FilePicker.getDirectoryPath();
    if (dir != null) setState(() => crit.folder = dir);
  }

  Future<void> _search() async {
    final c = cfg;
    if (c == null) return;
    if (!c.isComplete) {
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('Set up the SMB share first')));
      _openSettings();
      return;
    }
    final q = crit;
    q.extensions = _exts.text;
    q.nameContains = _name.text;
    final r = await Navigator.push<bool>(
      context,
      MaterialPageRoute(builder: (_) => ResultsScreen(cfg: c, criteria: q)),
    );
    if (r == true) {
      final ls = await SyncState.lastMediaSync();
      setState(() => lastSync = ls);
    }
  }

  void _syncNew() {
    _exts.clear();
    _name.clear();
    setState(() {
      crit
        ..source = Source.media
        ..kind = MediaKind.both
        // a day of overlap; anything already on the share is skipped
        ..from = lastSync?.subtract(const Duration(days: 1))
        ..to = null;
    });
    _search();
  }

  @override
  Widget build(BuildContext context) {
    final c = cfg;
    if (c == null) return const Scaffold(body: Center(child: CircularProgressIndicator()));
    final t = Theme.of(context).textTheme;
    final dateText = crit.from == null && crit.to == null
        ? 'Any date'
        : '${crit.from == null ? 'start' : formatDate(crit.from!)}  →  ${crit.to == null ? 'today' : formatDate(crit.to!)}';

    return Scaffold(
      appBar: AppBar(title: const Text('SMB Sync'), actions: [
        IconButton(onPressed: _openSettings, icon: const Icon(Icons.settings), tooltip: 'SMB share'),
      ]),
      body: ListView(padding: const EdgeInsets.all(16), children: [
        Card(
          child: ListTile(
            leading: const Icon(Icons.dns_outlined),
            title: Text(c.isComplete ? c.display : 'No share set up yet'),
            subtitle: Text(c.isComplete
                ? 'Destination · tap to change'
                : 'Tap to enter your server, share and folder'),
            onTap: _openSettings,
          ),
        ),
        const SizedBox(height: 8),
        FilledButton.tonalIcon(
          onPressed: _syncNew,
          icon: const Icon(Icons.sync),
          label: Text(lastSync == null
              ? 'Sync all photos & videos'
              : 'Sync photos & videos since ${formatDate(lastSync!)}'),
        ),
        const SizedBox(height: 24),
        Text('Find files', style: t.titleLarge),
        const SizedBox(height: 12),
        SegmentedButton<Source>(
          segments: const [
            ButtonSegment(value: Source.media, icon: Icon(Icons.photo_library_outlined), label: Text('Photos & videos')),
            ButtonSegment(value: Source.folder, icon: Icon(Icons.folder_outlined), label: Text('Files')),
          ],
          selected: {crit.source},
          onSelectionChanged: (s) => setState(() => crit.source = s.first),
        ),
        const SizedBox(height: 16),
        if (crit.source == Source.media)
          SegmentedButton<MediaKind>(
            segments: const [
              ButtonSegment(value: MediaKind.both, label: Text('Both')),
              ButtonSegment(value: MediaKind.photos, label: Text('Photos')),
              ButtonSegment(value: MediaKind.videos, label: Text('Videos')),
            ],
            selected: {crit.kind},
            onSelectionChanged: (s) => setState(() => crit.kind = s.first),
          ),
        if (crit.source == Source.folder) ...[
          ListTile(
            contentPadding: EdgeInsets.zero,
            leading: const Icon(Icons.folder_open),
            title: Text(crit.folder ?? (Platform.isAndroid ? 'Whole phone storage' : 'This app\'s folder')),
            subtitle: Text(crit.folder == null
                ? (Platform.isIOS
                    ? 'Tap to choose a folder (e.g. On My iPhone › Downloads). Subfolders are included.'
                    : (_defaultRoot ?? ''))
                : 'Subfolders are included · tap to change'),
            trailing: crit.folder == null
                ? null
                : IconButton(
                    icon: const Icon(Icons.clear), onPressed: () => setState(() => crit.folder = null)),
            onTap: _pickFolder,
          ),
          const SizedBox(height: 8),
          Wrap(spacing: 8, runSpacing: 4, children: [
            for (final e in _presets.entries)
              ActionChip(
                label: Text(e.key),
                onPressed: () => setState(() => _exts.text = e.value),
              ),
          ]),
        ],
        const SizedBox(height: 12),
        TextField(
          controller: _exts,
          autocorrect: false,
          decoration: InputDecoration(
            labelText: 'File types',
            hintText: crit.source == Source.media ? 'any  (or e.g. heic jpg)' : 'any  (or e.g. pdf docx)',
            prefixIcon: const Icon(Icons.description_outlined),
            suffixIcon: IconButton(icon: const Icon(Icons.clear), onPressed: () => _exts.clear()),
          ),
        ),
        const SizedBox(height: 12),
        TextField(
          controller: _name,
          decoration: InputDecoration(
            labelText: 'Name contains',
            prefixIcon: const Icon(Icons.search),
            suffixIcon: IconButton(icon: const Icon(Icons.clear), onPressed: () => _name.clear()),
          ),
        ),
        const SizedBox(height: 12),
        ListTile(
          contentPadding: EdgeInsets.zero,
          leading: const Icon(Icons.date_range),
          title: Text(dateText),
          subtitle: Text(crit.source == Source.media ? 'Date taken' : 'Date modified'),
          onTap: _pickRange,
          trailing: crit.from == null && crit.to == null
              ? null
              : IconButton(
                  icon: const Icon(Icons.clear),
                  onPressed: () => setState(() {
                        crit.from = null;
                        crit.to = null;
                      })),
        ),
        Wrap(spacing: 8, children: [
          ActionChip(label: const Text('From…'), onPressed: () => _pickDate(true)),
          ActionChip(label: const Text('To…'), onPressed: () => _pickDate(false)),
          ActionChip(
              label: const Text('Last 30 days'),
              onPressed: () => setState(() {
                    crit.from = DateTime.now().subtract(const Duration(days: 30));
                    crit.to = null;
                  })),
          ActionChip(
              label: const Text('This year'),
              onPressed: () => setState(() {
                    crit.from = DateTime(DateTime.now().year);
                    crit.to = null;
                  })),
          ActionChip(
              label: const Text('Older than 1 year'),
              onPressed: () => setState(() {
                    crit.from = null;
                    crit.to = DateTime.now().subtract(const Duration(days: 365));
                  })),
        ]),
        if (crit.source == Source.folder)
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text('Include hidden files & folders'),
            value: crit.includeHidden,
            onChanged: (v) => setState(() => crit.includeHidden = v),
          ),
        const SizedBox(height: 20),
        FilledButton.icon(
          onPressed: () => _search(),
          icon: const Icon(Icons.search),
          label: const Text('Search'),
          style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(52)),
        ),
        if (Platform.isAndroid && crit.source == Source.folder)
          TextButton(
            onPressed: () => openAppSettings(),
            child: const Text('Files not showing? Check app permissions'),
          ),
      ]),
    );
  }
}
