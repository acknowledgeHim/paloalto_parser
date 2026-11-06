// Pure helpers (no Flutter / plugins) so they can be unit-tested.

enum Subfolders { none, year, yearMonth, yearMonthDay }

enum Conflict { skipSameSize, keepBoth, overwrite }

/// Joins SMB path parts into "/share/dir/file": forward slashes, no doubles,
/// no trailing slash. Backslashes (Windows style) are accepted.
String joinRemote(List<String> parts) {
  final segs = <String>[];
  for (final p in parts) {
    for (final s in p.replaceAll('\\', '/').split('/')) {
      final t = s.trim();
      if (t.isNotEmpty && t != '.') segs.add(t);
    }
  }
  return '/${segs.join('/')}';
}

String _two(int n) => n.toString().padLeft(2, '0');

/// "2024", "2024/07" or "2024/07/15" (empty for [Subfolders.none]).
String datedSubfolder(DateTime d, Subfolders mode) {
  switch (mode) {
    case Subfolders.none:
      return '';
    case Subfolders.year:
      return '${d.year}';
    case Subfolders.yearMonth:
      return '${d.year}/${_two(d.month)}';
    case Subfolders.yearMonthDay:
      return '${d.year}/${_two(d.month)}/${_two(d.day)}';
  }
}

/// Replaces characters Windows / Samba shares refuse in file names.
String safeName(String name) {
  var n = name.replaceAll(RegExp(r'[\\/:*?"<>|\x00-\x1F]'), '_').trim();
  // Windows also refuses trailing dots and spaces.
  n = n.replaceAll(RegExp(r'[. ]+$'), '');
  return n.isEmpty ? 'file' : n;
}

/// "IMG_1.jpg", 2 -> "IMG_1 (2).jpg"
String alternateName(String name, int n) {
  final dot = name.lastIndexOf('.');
  if (dot <= 0) return '$name ($n)';
  return '${name.substring(0, dot)} ($n)${name.substring(dot)}';
}

/// "pdf, .DOCX  jpg;png" -> {"pdf","docx","jpg","png"}
Set<String> parseExtensions(String text) => text
    .toLowerCase()
    .split(RegExp(r'[\s,;]+'))
    .map((e) => e.trim().replaceFirst(RegExp(r'^\*?\.'), ''))
    .where((e) => e.isNotEmpty)
    .toSet();

String extensionOf(String name) {
  final dot = name.lastIndexOf('.');
  return dot <= 0 ? '' : name.substring(dot + 1).toLowerCase();
}

bool matchesExtensions(String name, Set<String> exts) =>
    exts.isEmpty || exts.contains(extensionOf(name));

/// Start of [d]'s day.
DateTime dayStart(DateTime d) => DateTime(d.year, d.month, d.day);

/// Last millisecond of [d]'s day, so a "to" date includes that whole day.
DateTime dayEnd(DateTime d) =>
    DateTime(d.year, d.month, d.day + 1).subtract(const Duration(milliseconds: 1));

bool inRange(DateTime d, DateTime? from, DateTime? to) =>
    (from == null || !d.isBefore(dayStart(from))) &&
    (to == null || !d.isAfter(dayEnd(to)));

String formatDate(DateTime d) => '${d.year}-${_two(d.month)}-${_two(d.day)}';

String formatBytes(int b) {
  if (b < 0) return '?';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  var v = b.toDouble();
  var i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return '${v.toStringAsFixed(i == 0 ? 0 : 1)} ${units[i]}';
}

class SmbAddress {
  final String host;
  final String share;
  final String folder;
  const SmbAddress(this.host, this.share, this.folder);
}

/// Accepts what people copy out of Explorer / Finder:
///   \\nas\photos\phone   smb://nas/photos/phone   nas/photos/phone
/// Returns null when there is no host.
SmbAddress? parseSmbAddress(String input) {
  var s = input.trim();
  s = s.replaceFirst(RegExp(r'^smb://', caseSensitive: false), '');
  s = s.replaceAll('\\', '/');
  final parts = s.split('/').where((p) => p.trim().isNotEmpty).toList();
  if (parts.isEmpty) return null;
  final host = parts[0].trim();
  final share = parts.length > 1 ? parts[1].trim() : '';
  final folder = parts.length > 2 ? parts.sublist(2).join('/') : '';
  return SmbAddress(host, share, folder);
}
