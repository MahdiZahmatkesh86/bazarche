import os
import shutil
import subprocess

# ⚠️ لینک مخزن خودت رو اینجا بذار (دقیقاً همینطوری)
GITHUB_REPO_URL = "https://github.com/MahdiZahmatkesh86/bazarche_app.git"

print("🚨 هشدار: در حال پاک کردن کامل تاریخچه گیت...")
print("⏳ 1. در حال حذف پوشه .git (تاریخچه قبلی)...")

# حذف پوشه .git
if os.path.exists('.git'):
    shutil.rmtree('.git', ignore_errors=True)
    print("✅ پوشه .git با موفقیت پاک شد.")
else:
    print("ℹ️ پوشه .git پیدا نشد (شاید قبلاً پاک شده).")

print("⏳ 2. در حال ساخت یک تاریخچه کاملاً جدید...")
# دستورات گیت برای شروع تازه
commands = [
    ["git", "init"],
    ["git", "add", "."],
    ["git", "commit", "-m", "Initial clean commit - removed all backups"],
    ["git", "branch", "-M", "main"],
    ["git", "remote", "add", "origin", GITHUB_REPO_URL],
    ["git", "push", "-u", "origin", "main", "-f"] # دستور -f یعنی با زور جایگزین کن
]

for cmd in commands:
    try:
        # اجرای دستورات بدون نمایش خروجی‌های طولانی
        subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        print(f"✅ اجرا شد: {' '.join(cmd)}")
    except subprocess.CalledProcessError:
        print(f"❌ خطا در اجرای: {' '.join(cmd)}")
        print("لطفاً مطمئن شو که به اینترنت متصل هستی و لینک گیت‌هاب درست است.")

print("🎉 تمام شد! حالا به گیت‌هاب برو و صفحه رو رفرش کن.")