import 'dart:io';

import 'package:smb_connect/smb_connect.dart';

import 'config.dart';
import 'paths.dart';

enum UploadOutcome { uploaded, alreadyThere }

class UploadResult {
  final UploadOutcome outcome;
  final String remotePath;
  const UploadResult(this.outcome, this.remotePath);
}

/// Thin wrapper over smb_connect. Every upload is written to a temporary
/// ".part" name, its size checked on the share, then renamed — so a file
/// only appears under its real name once it is complete.
class SmbService {
  final ShareConfig cfg;
  SmbConnect? _c;
  final Set<String> _madeDirs = {};

  SmbService(this.cfg);

  Future<void> connect() async {
    await close();
    _madeDirs.clear();
    _c = await SmbConnect.connectAuth(
      host: cfg.host,
      domain: cfg.domain,
      username: cfg.username,
      password: cfg.password,
    ).timeout(const Duration(seconds: 20),
        onTimeout: () => throw 'Timed out connecting to ${cfg.host}');
  }

  SmbConnect get _conn {
    final c = _c;
    if (c == null) throw 'Not connected';
    return c;
  }

  Future<void> close() async {
    final c = _c;
    _c = null;
    if (c != null) {
      try {
        await c.close();
      } catch (_) {}
    }
  }

  /// Connects, makes sure the share is reachable and that we can write into
  /// the target folder (creates it, writes + removes a tiny test file).
  static Future<String> test(ShareConfig cfg) async {
    final s = SmbService(cfg);
    try {
      await s.connect();
      final root = await s._conn.file('${joinRemote([cfg.share])}/');
      if (!root.isExists) throw 'Share "${cfg.share}" not found on ${cfg.host}';
      final dir = joinRemote([cfg.share, cfg.folder]);
      await s.ensureDir(dir);
      final probePath = joinRemote([dir, '.smbsync-write-test']);
      final probe = await s._conn.createFile(probePath);
      final sink = await s._conn.openWrite(probe);
      sink.add([111, 107]);
      await sink.flush();
      await sink.close();
      final written = await s._conn.file(probePath);
      if (written.isExists && written.isFile()) await s._conn.delete(written);
      return 'Connected — ${cfg.display} is writable';
    } finally {
      await s.close();
    }
  }

  /// Creates every missing folder along "/share/a/b/c".
  Future<void> ensureDir(String dir) async {
    final segs = dir.split('/').where((s) => s.isNotEmpty).toList();
    // segs[0] is the share itself.
    for (var i = 2; i <= segs.length; i++) {
      final p = '/${segs.sublist(0, i).join('/')}';
      if (_madeDirs.contains(p)) continue;
      final f = await _conn.file(p);
      if (!f.isExists) {
        await _conn.createFolder(p);
      } else if (!f.isDirectory()) {
        throw '"$p" exists on the share but is a file, not a folder';
      }
      _madeDirs.add(p);
    }
  }

  /// Sub-folders of "/share/dir", for the folder browser.
  Future<List<String>> listDirs(String dir) async {
    final folder = await _conn.file(dir.endsWith('/') ? dir : '$dir/');
    if (!folder.isExists) throw 'Folder not found: $dir';
    final items = await _conn.listFiles(folder);
    final names = items
        .where((f) => f.isDirectory() && f.name != '.' && f.name != '..')
        .map((f) => f.name)
        .where((n) => n.isNotEmpty)
        .toList()
      ..sort((a, b) => a.toLowerCase().compareTo(b.toLowerCase()));
    return names;
  }

  Future<List<String>> listShares() async {
    final shares = await _conn.listShares();
    return shares
        .map((s) => s.name.isNotEmpty ? s.name : s.share)
        .where((n) => n.isNotEmpty && !n.endsWith('\$'))
        .toList();
  }

  Future<String> _freeName(String dir, String name) async {
    for (var n = 1; n < 10000; n++) {
      final p = joinRemote([dir, alternateName(name, n)]);
      if (!(await _conn.file(p)).isExists) return p;
    }
    throw 'Could not find a free name for $name';
  }

  Future<UploadResult> upload(
    File local,
    String dir,
    String name,
    void Function(int sent) onProgress,
  ) async {
    final size = await local.length();
    await ensureDir(dir);
    var target = joinRemote([dir, name]);
    var replace = false;

    final existing = await _conn.file(target);
    if (existing.isExists) {
      if (existing.isDirectory()) {
        target = await _freeName(dir, name);
      } else {
        switch (cfg.conflict) {
          case Conflict.skipSameSize:
            if (existing.size == size) {
              onProgress(size);
              return UploadResult(UploadOutcome.alreadyThere, target);
            }
            target = await _freeName(dir, name);
          case Conflict.keepBoth:
            target = await _freeName(dir, name);
          case Conflict.overwrite:
            replace = true;
        }
      }
    }

    final tmpPath = joinRemote([dir, '.$name.smbsync-part']);
    final oldTmp = await _conn.file(tmpPath);
    if (oldTmp.isExists && oldTmp.isFile()) await _conn.delete(oldTmp);

    final tmp = await _conn.createFile(tmpPath);
    final sink = await _conn.openWrite(tmp);
    var sent = 0;
    try {
      await sink.addStream(local.openRead().map((chunk) {
        sent += chunk.length;
        onProgress(sent);
        return chunk;
      }));
      await sink.flush();
    } finally {
      await sink.close();
    }

    final written = await _conn.file(tmpPath);
    if (!written.isExists || written.size != size) {
      if (written.isExists && written.isFile()) {
        try {
          await _conn.delete(written);
        } catch (_) {}
      }
      throw 'Size check failed (phone $size bytes, share ${written.size} bytes)';
    }
    await _conn.rename(written, target, replace: replace);

    final done = await _conn.file(target);
    if (!done.isExists || done.size != size) {
      throw 'File not found with the right size after upload';
    }
    return UploadResult(UploadOutcome.uploaded, target);
  }
}
