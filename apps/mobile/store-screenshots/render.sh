#!/bin/sh
# Render store screenshots with headless Chrome. Output goes to out/ (gitignored).
# gallery.html lays out the series; each phone shows screen.html, which draws the app screen from its Figma
# spec in the series language.
# usage: render.sh <horizon|fil> <en|fr> <ios|ios-6.3|play|fg|preview>
#   ios     -> out/<d>/ios/<lang>/01..06.png           1290x2796 (App Store, iPhone Dynamic Island large, 6.9")
#   ios-6.3 -> out/<d>/ios-6.3/<lang>/01..06.png       1206x2622 (App Store, iPhone Dynamic Island medium, 6.3")
#   play    -> out/<d>/play/<lang>/01..06.png          1080x1920 (Google Play phone, 9:16)
#   fg      -> out/<d>/play/<lang>/feature-graphic.png 1024x500
#   preview -> out/<d>/preview-<lang>.png              whole iOS strip at 1x
set -e
d=$1; lang=$2; kind=$3; here=$(cd "$(dirname "$0")" && pwd); cd "$here"
chrome() { "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu --hide-scrollbars \
  --allow-file-access-from-files --force-device-scale-factor=$1 --window-size=$2 --virtual-time-budget=10000 \
  --screenshot="$3" "file://$here/gallery.html?$4" >/dev/null 2>&1; }
case $kind in
  preview) mkdir -p out/$d; chrome 1 2580,932 "$here/out/$d/preview-$lang.png" "d=$d&lang=$lang&p=ios" ;;
  fg) mkdir -p out/$d/play/$lang; chrome 2 512,250 "$here/out/$d/play/$lang/feature-graphic.png" "d=$d&lang=$lang&mode=fg" ;;
  ios|ios-6.3|play)
    case $kind in ios) s=3; win=430,932 ;; ios-6.3) s=3; win=402,874 ;; play) s=2.5; win=432,768 ;; esac
    dir=out/$d/$kind/$lang; mkdir -p $dir
    for i in 0 1 2 3 4 5; do chrome $s $win "$here/$dir/0$((i + 1)).png" "d=$d&lang=$lang&p=$kind&i=$i" & done; wait ;;
esac
