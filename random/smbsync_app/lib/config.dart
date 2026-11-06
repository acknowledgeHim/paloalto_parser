import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'paths.dart';

/// Where files go. The password is kept in the phone's secure storage
/// (Android Keystore / iOS Keychain), everything else in preferences.
class ShareConfig {
  String host;
  String share;
  String folder;
  String username;
  String password;
  String domain;
  Subfolders subfolders;
  Conflict conflict;

  ShareConfig({
    this.host = '',
    this.share = '',
    this.folder = '',
    this.username = '',
    this.password = '',
    this.domain = '',
    this.subfolders = Subfolders.yearMonth,
    this.conflict = Conflict.skipSameSize,
  });

  bool get isComplete => host.isNotEmpty && share.isNotEmpty;

  /// \\host\share\folder — for display.
  String get display =>
      '\\\\$host\\$share${folder.isEmpty ? '' : '\\${folder.replaceAll('/', '\\')}'}';

  ShareConfig copy() => ShareConfig(
        host: host,
        share: share,
        folder: folder,
        username: username,
        password: password,
        domain: domain,
        subfolders: subfolders,
        conflict: conflict,
      );

  Map<String, dynamic> _toJson() => {
        'host': host,
        'share': share,
        'folder': folder,
        'username': username,
        'domain': domain,
        'subfolders': subfolders.name,
        'conflict': conflict.name,
      };

  static ShareConfig _fromJson(Map<String, dynamic> j) => ShareConfig(
        host: j['host'] ?? '',
        share: j['share'] ?? '',
        folder: j['folder'] ?? '',
        username: j['username'] ?? '',
        domain: j['domain'] ?? '',
        subfolders: Subfolders.values.firstWhere(
            (e) => e.name == j['subfolders'],
            orElse: () => Subfolders.yearMonth),
        conflict: Conflict.values.firstWhere((e) => e.name == j['conflict'],
            orElse: () => Conflict.skipSameSize),
      );

  static const _prefsKey = 'share_config';
  static const _pwKey = 'share_password';
  static const _secure = FlutterSecureStorage();

  static Future<ShareConfig> load() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_prefsKey);
    final cfg = raw == null ? ShareConfig() : _fromJson(jsonDecode(raw));
    try {
      cfg.password = await _secure.read(key: _pwKey) ?? '';
    } catch (_) {
      cfg.password = '';
    }
    return cfg;
  }

  Future<void> save() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_prefsKey, jsonEncode(_toJson()));
    await _secure.write(key: _pwKey, value: password);
  }
}

/// When "Sync new photos & videos" last finished, so the next one only
/// looks at newer items.
class SyncState {
  static const _key = 'last_media_sync';

  static Future<DateTime?> lastMediaSync() async {
    final prefs = await SharedPreferences.getInstance();
    final ms = prefs.getInt(_key);
    return ms == null ? null : DateTime.fromMillisecondsSinceEpoch(ms);
  }

  static Future<void> setLastMediaSync(DateTime t) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setInt(_key, t.millisecondsSinceEpoch);
  }
}
