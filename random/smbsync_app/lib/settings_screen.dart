import 'dart:io';

import 'package:flutter/material.dart';
import 'package:photo_manager/photo_manager.dart';

import 'config.dart';
import 'paths.dart';
import 'smb_service.dart';

class SettingsScreen extends StatefulWidget {
  final ShareConfig cfg;
  const SettingsScreen({super.key, required this.cfg});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  late final ShareConfig c = widget.cfg.copy();
  late final _host = TextEditingController(text: c.host);
  late final _share = TextEditingController(text: c.share);
  late final _folder = TextEditingController(text: c.folder);
  late final _user = TextEditingController(text: c.username);
  late final _pass = TextEditingController(text: c.password);
  late final _domain = TextEditingController(text: c.domain);
  bool _showPw = false;
  bool _busy = false;
  String? _testMsg;
  bool _testOk = false;

  void _pull() {
    // Someone pasted \\nas\share\folder (or smb://…) into the server box.
    final a = parseSmbAddress(_host.text);
    if (a != null && (a.share.isNotEmpty || _host.text.contains(RegExp(r'[\\/]')))) {
      _host.text = a.host;
      if (a.share.isNotEmpty) _share.text = a.share;
      if (a.folder.isNotEmpty) _folder.text = a.folder;
    }
    c
      ..host = _host.text.trim()
      ..share = _share.text.trim().replaceAll(RegExp(r'^[\\/]+|[\\/]+$'), '')
      ..folder = _folder.text.trim().replaceAll('\\', '/').replaceAll(RegExp(r'^/+|/+$'), '')
      ..username = _user.text.trim()
      ..password = _pass.text
      ..domain = _domain.text.trim();
  }

  Future<void> _test() async {
    _pull();
    if (!c.isComplete) {
      setState(() {
        _testOk = false;
        _testMsg = 'Enter the server and the share name first';
      });
      return;
    }
    setState(() {
      _busy = true;
      _testMsg = null;
    });
    try {
      final msg = await SmbService.test(c);
      setState(() {
        _testOk = true;
        _testMsg = msg;
      });
    } catch (e) {
      setState(() {
        _testOk = false;
        _testMsg = 'Failed: $e';
      });
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _browse() async {
    _pull();
    if (c.host.isEmpty) return;
    final picked = await Navigator.push<_Picked>(
      context,
      MaterialPageRoute(builder: (_) => _RemoteBrowser(cfg: c.copy())),
    );
    if (picked != null) {
      setState(() {
        _share.text = picked.share;
        _folder.text = picked.folder;
      });
    }
  }

  Future<void> _save() async {
    _pull();
    await c.save();
    if (mounted) Navigator.pop(context, c);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('SMB share'),
        actions: [TextButton(onPressed: _save, child: const Text('Save'))],
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          TextField(
            controller: _host,
            keyboardType: TextInputType.url,
            autocorrect: false,
            decoration: const InputDecoration(
              labelText: 'Server',
              hintText: '192.168.1.20  or  nas.local  or  \\\\nas\\share\\folder',
              helperText: 'IP or name. You can paste a full \\\\server\\share\\folder path.',
            ),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _share,
            autocorrect: false,
            decoration: const InputDecoration(labelText: 'Share', hintText: 'photos'),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _folder,
            autocorrect: false,
            decoration: InputDecoration(
              labelText: 'Folder on the share (created if missing)',
              hintText: 'Phones/MyPhone',
              suffixIcon: IconButton(
                tooltip: 'Browse the share',
                icon: const Icon(Icons.folder_open),
                onPressed: _busy ? null : _browse,
              ),
            ),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _user,
            autocorrect: false,
            decoration: const InputDecoration(labelText: 'Username', hintText: 'blank for guest'),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _pass,
            obscureText: !_showPw,
            autocorrect: false,
            decoration: InputDecoration(
              labelText: 'Password',
              helperText: 'Stored in the phone\'s secure storage',
              suffixIcon: IconButton(
                icon: Icon(_showPw ? Icons.visibility_off : Icons.visibility),
                onPressed: () => setState(() => _showPw = !_showPw),
              ),
            ),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _domain,
            autocorrect: false,
            decoration: const InputDecoration(
                labelText: 'Domain / workgroup (optional)', hintText: 'WORKGROUP'),
          ),
          const SizedBox(height: 24),
          Text('Put files in sub-folders by date', style: Theme.of(context).textTheme.titleSmall),
          RadioGroup<Subfolders>(
            groupValue: c.subfolders,
            onChanged: (v) => setState(() => c.subfolders = v!),
            child: const Column(children: [
              RadioListTile(value: Subfolders.none, title: Text('No — all in the folder')),
              RadioListTile(value: Subfolders.year, title: Text('Year  (2024/)')),
              RadioListTile(value: Subfolders.yearMonth, title: Text('Year / month  (2024/07/)')),
              RadioListTile(value: Subfolders.yearMonthDay, title: Text('Year / month / day  (2024/07/15/)')),
            ]),
          ),
          const SizedBox(height: 8),
          Text('If a file with the same name is already there',
              style: Theme.of(context).textTheme.titleSmall),
          RadioGroup<Conflict>(
            groupValue: c.conflict,
            onChanged: (v) => setState(() => c.conflict = v!),
            child: const Column(children: [
              RadioListTile(
                value: Conflict.skipSameSize,
                title: Text('Skip it if it is the same size (sync)'),
                subtitle: Text('Different size → saved as "name (1).jpg"'),
              ),
              RadioListTile(value: Conflict.keepBoth, title: Text('Always keep both')),
              RadioListTile(value: Conflict.overwrite, title: Text('Replace the one on the share')),
            ]),
          ),
          const SizedBox(height: 16),
          FilledButton.icon(
            onPressed: _busy ? null : _test,
            icon: _busy
                ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
                : const Icon(Icons.wifi_tethering),
            label: const Text('Test connection'),
          ),
          if (_testMsg != null)
            Padding(
              padding: const EdgeInsets.only(top: 12),
              child: Text(_testMsg!,
                  style: TextStyle(color: _testOk ? Colors.green.shade700 : Theme.of(context).colorScheme.error)),
            ),
          if (Platform.isAndroid) ...[
            const Divider(height: 40),
            ListTile(
              contentPadding: EdgeInsets.zero,
              leading: const Icon(Icons.delete_sweep_outlined),
              title: const Text('Let "Move" remove photos without asking each time'),
              subtitle: const Text('Android 12+: opens Settings → "Media management apps". Optional.'),
              onTap: () => PhotoManager.requestManageMedia(),
            ),
          ],
          const SizedBox(height: 12),
          const Text(
            'Works with Windows shares, Synology / QNAP / TrueNAS, Samba on Linux / Raspberry Pi '
            '(SMB 2.0 / 2.1). Shares that require SMB3 encryption are not supported.',
            style: TextStyle(fontSize: 12, color: Colors.grey),
          ),
        ],
      ),
    );
  }
}

class _Picked {
  final String share;
  final String folder;
  _Picked(this.share, this.folder);
}

/// Browse shares and folders on the server to pick the destination.
class _RemoteBrowser extends StatefulWidget {
  final ShareConfig cfg;
  const _RemoteBrowser({required this.cfg});

  @override
  State<_RemoteBrowser> createState() => _RemoteBrowserState();
}

class _RemoteBrowserState extends State<_RemoteBrowser> {
  late final SmbService smb = SmbService(widget.cfg);
  String? share;
  List<String> path = [];
  List<String> entries = [];
  bool loading = true;
  String? error;

  @override
  void initState() {
    super.initState();
    share = widget.cfg.share.isEmpty ? null : widget.cfg.share;
    path = widget.cfg.folder.split('/').where((s) => s.isNotEmpty).toList();
    _load(connect: true);
  }

  @override
  void dispose() {
    smb.close();
    super.dispose();
  }

  Future<void> _load({bool connect = false}) async {
    setState(() {
      loading = true;
      error = null;
    });
    try {
      if (connect) await smb.connect();
      final list = share == null
          ? await smb.listShares()
          : await smb.listDirs(joinRemote([share!, ...path]));
      setState(() => entries = list);
    } catch (e) {
      // Folder from settings may not exist yet — fall back to the share root.
      if (share != null && path.isNotEmpty) {
        path = [];
        return _load();
      }
      setState(() => error = '$e');
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  Future<void> _newFolder() async {
    final ctl = TextEditingController();
    final name = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('New folder'),
        content: TextField(controller: ctl, autofocus: true),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          TextButton(onPressed: () => Navigator.pop(ctx, ctl.text.trim()), child: const Text('Create')),
        ],
      ),
    );
    if (name == null || name.isEmpty) return;
    try {
      await smb.ensureDir(joinRemote([share!, ...path, safeName(name)]));
      path = [...path, safeName(name)];
      await _load();
    } catch (e) {
      setState(() => error = '$e');
    }
  }

  void _up() {
    if (path.isNotEmpty) {
      path = path.sublist(0, path.length - 1);
    } else {
      share = null;
    }
    _load();
  }

  @override
  Widget build(BuildContext context) {
    final here = share == null ? '\\\\${widget.cfg.host}' : joinRemote([share!, ...path]);
    return Scaffold(
      appBar: AppBar(title: Text(here, overflow: TextOverflow.ellipsis)),
      body: loading
          ? const Center(child: CircularProgressIndicator())
          : error != null
              ? Padding(padding: const EdgeInsets.all(16), child: Text('Error: $error'))
              : ListView(children: [
                  if (share != null)
                    ListTile(leading: const Icon(Icons.arrow_upward), title: const Text('..'), onTap: _up),
                  for (final e in entries)
                    ListTile(
                      leading: Icon(share == null ? Icons.dns_outlined : Icons.folder),
                      title: Text(e),
                      onTap: () {
                        if (share == null) {
                          share = e;
                        } else {
                          path = [...path, e];
                        }
                        _load();
                      },
                    ),
                  if (entries.isEmpty)
                    const Padding(padding: EdgeInsets.all(16), child: Text('(no folders here)')),
                ]),
      bottomNavigationBar: share == null
          ? null
          : SafeArea(
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Row(children: [
                  OutlinedButton.icon(
                      onPressed: _newFolder, icon: const Icon(Icons.create_new_folder), label: const Text('New')),
                  const SizedBox(width: 12),
                  Expanded(
                    child: FilledButton(
                      onPressed: () => Navigator.pop(context, _Picked(share!, path.join('/'))),
                      child: const Text('Use this folder'),
                    ),
                  ),
                ]),
              ),
            ),
    );
  }
}
