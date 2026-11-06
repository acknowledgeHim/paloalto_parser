import 'package:flutter_test/flutter_test.dart';
import 'package:smbsync/paths.dart';

void main() {
  test('joinRemote normalises slashes', () {
    expect(joinRemote(['photos', '', 'Phones\\Mine/', '/2024/07']), '/photos/Phones/Mine/2024/07');
    expect(joinRemote(['share']), '/share');
  });

  test('datedSubfolder', () {
    final d = DateTime(2024, 7, 5);
    expect(datedSubfolder(d, Subfolders.none), '');
    expect(datedSubfolder(d, Subfolders.year), '2024');
    expect(datedSubfolder(d, Subfolders.yearMonth), '2024/07');
    expect(datedSubfolder(d, Subfolders.yearMonthDay), '2024/07/05');
  });

  test('safeName and alternateName', () {
    expect(safeName('a:b*c?.jpg'), 'a_b_c_.jpg');
    expect(safeName('trailing. '), 'trailing');
    expect(alternateName('IMG_1.jpg', 2), 'IMG_1 (2).jpg');
    expect(alternateName('README', 1), 'README (1)');
    expect(alternateName('.hidden', 1), '.hidden (1)');
  });

  test('extensions', () {
    expect(parseExtensions('pdf, .DOCX  *.jpg;png'), {'pdf', 'docx', 'jpg', 'png'});
    expect(matchesExtensions('Scan.PDF', {'pdf'}), isTrue);
    expect(matchesExtensions('Scan.pdf.txt', {'pdf'}), isFalse);
    expect(matchesExtensions('anything', {}), isTrue);
  });

  test('date range includes whole end day', () {
    final from = DateTime(2024, 1, 1);
    final to = DateTime(2024, 1, 31);
    expect(inRange(DateTime(2024, 1, 31, 23, 59), from, to), isTrue);
    expect(inRange(DateTime(2024, 2, 1), from, to), isFalse);
    expect(inRange(DateTime(2023, 12, 31, 23, 59), from, to), isFalse);
    expect(inRange(DateTime(2000), null, null), isTrue);
  });

  test('parseSmbAddress', () {
    final a = parseSmbAddress(r'\\nas\photos\Phones\Mine')!;
    expect([a.host, a.share, a.folder], ['nas', 'photos', 'Phones/Mine']);
    final b = parseSmbAddress('smb://192.168.1.5/backup')!;
    expect([b.host, b.share, b.folder], ['192.168.1.5', 'backup', '']);
    expect(parseSmbAddress('   '), isNull);
  });

  test('formatBytes', () {
    expect(formatBytes(512), '512 B');
    expect(formatBytes(1536), '1.5 KB');
  });
}
