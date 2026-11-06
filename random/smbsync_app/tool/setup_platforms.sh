#!/usr/bin/env bash
# Generates android/ and ios/ with `flutter create` (they are not committed)
# and applies the permissions / settings SMB Sync needs.
# Usage (from random/smbsync_app):  tool/setup_platforms.sh
set -euo pipefail
cd "$(dirname "$0")/.."

flutter create --org app.smbsync --project-name smbsync --platforms android,ios . >/dev/null
rm -f test/widget_test.dart   # flutter create's counter-app sample test

python3 - <<'PY'
import plistlib, re, sys
from pathlib import Path

def must_sub(text, pattern, repl, what, count=1, flags=0):
    new, n = re.subn(pattern, repl, text, count=count, flags=flags)
    if n == 0:
        sys.exit(f"setup_platforms: could not patch {what} (pattern not found: {pattern})")
    return new

# ---------------- Android manifest ----------------
m = Path("android/app/src/main/AndroidManifest.xml")
s = m.read_text()
if "MANAGE_EXTERNAL_STORAGE" not in s:
    perms = """
    <uses-permission android:name="android.permission.INTERNET"/>
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
    <uses-permission android:name="android.permission.WAKE_LOCK"/>
    <uses-permission android:name="android.permission.READ_MEDIA_IMAGES"/>
    <uses-permission android:name="android.permission.READ_MEDIA_VIDEO"/>
    <uses-permission android:name="android.permission.READ_MEDIA_VISUAL_USER_SELECTED"/>
    <uses-permission android:name="android.permission.ACCESS_MEDIA_LOCATION"/>
    <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" android:maxSdkVersion="32"/>
    <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" android:maxSdkVersion="29"/>
    <uses-permission android:name="android.permission.MANAGE_EXTERNAL_STORAGE"/>
    <uses-permission android:name="android.permission.MANAGE_MEDIA"/>
"""
    s = must_sub(s, r"(<manifest[^>]*>)", r"\1" + perms.replace("\\", "\\\\"), "manifest permissions")
    s = must_sub(s, r'android:label="[^"]*"', 'android:label="SMB Sync"', "app label")
    s = must_sub(s, r"<application", '<application\n        android:requestLegacyExternalStorage="true"', "application tag")
    m.write_text(s)

# ---------------- Android gradle ----------------
g = Path("android/app/build.gradle.kts")
s = g.read_text()
if "SMBSYNC_KEYSTORE" not in s:
    s = must_sub(s, r"minSdk\s*=\s*flutter\.minSdkVersion", "minSdk = 24", "minSdk")
    signing = '''signingConfigs {
        create("release") {
            val ks = System.getenv("SMBSYNC_KEYSTORE")
            if (ks != null) {
                storeFile = file(ks)
                storePassword = System.getenv("SMBSYNC_KEYSTORE_PASSWORD")
                keyAlias = System.getenv("SMBSYNC_KEY_ALIAS") ?: "smbsync"
                keyPassword = System.getenv("SMBSYNC_KEYSTORE_PASSWORD")
                storeType = "pkcs12"
            }
        }
    }

    buildTypes {'''
    s = must_sub(s, r"buildTypes \{", signing, "signingConfigs")
    s = must_sub(s, r'signingConfig = signingConfigs\.getByName\("debug"\)',
                 'signingConfig = if (System.getenv("SMBSYNC_KEYSTORE") != null) '
                 'signingConfigs.getByName("release") else signingConfigs.getByName("debug")',
                 "release signingConfig")
    g.write_text(s)

# ---------------- iOS Info.plist ----------------
p = Path("ios/Runner/Info.plist")
d = plistlib.loads(p.read_bytes())
d.update({
    "CFBundleDisplayName": "SMB Sync",
    "NSPhotoLibraryUsageDescription":
        "SMB Sync reads your photos and videos to copy them to your SMB share, "
        "and removes them only when you choose Move.",
    "NSPhotoLibraryAddUsageDescription": "SMB Sync needs access to your photo library.",
    "NSLocalNetworkUsageDescription":
        "SMB Sync connects to your file server (SMB share) on your local network.",
    "UIFileSharingEnabled": True,
    "LSSupportsOpeningDocumentsInPlace": True,
    "PHPhotoLibraryPreventAutomaticLimitedAccessAlert": True,
})
p.write_bytes(plistlib.dumps(d))

# ---------------- iOS deployment target (file_picker needs 14) ----------------
pod = Path("ios/Podfile")
if not pod.exists():
    # Same as the Podfile the Flutter tool writes on first build, but with the
    # platform line set up front.
    pod.write_text("""platform :ios, '14.0'
ENV['COCOAPODS_DISABLE_STATS'] = 'true'
project 'Runner', { 'Debug' => :debug, 'Profile' => :release, 'Release' => :release }

def flutter_root
  generated = File.expand_path(File.join('..', 'Flutter', 'Generated.xcconfig'), __FILE__)
  raise "#{generated} must exist. Run flutter pub get first" unless File.exist?(generated)
  File.foreach(generated) do |line|
    matches = line.match(/FLUTTER_ROOT\\=(.*)/)
    return matches[1].strip if matches
  end
  raise "FLUTTER_ROOT not found in #{generated}"
end

require File.expand_path(File.join('packages', 'flutter_tools', 'bin', 'podhelper'), flutter_root)
flutter_ios_podfile_setup

target 'Runner' do
  use_frameworks!
  flutter_install_all_ios_pods File.dirname(File.realpath(__FILE__))
  target 'RunnerTests' do
    inherit! :search_paths
  end
end

post_install do |installer|
  installer.pods_project.targets.each do |target|
    flutter_additional_ios_build_settings(target)
    target.build_configurations.each do |config|
      config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '14.0'
    end
  end
end
""")
else:
    s = pod.read_text()
    s = re.sub(r"^#?\s*platform :ios, '[0-9.]+'", "platform :ios, '14.0'", s, flags=re.M)
    pod.write_text(s)
pbx = Path("ios/Runner.xcodeproj/project.pbxproj")
s = pbx.read_text()
s = re.sub(r"IPHONEOS_DEPLOYMENT_TARGET = [0-9.]+;", "IPHONEOS_DEPLOYMENT_TARGET = 14.0;", s)
pbx.write_text(s)
print("setup_platforms: android/ and ios/ ready")
PY
