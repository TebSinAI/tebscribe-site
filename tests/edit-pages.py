"""One-off: swap the inline gtag block for tb-consent.js on every page. Run from the site root."""
import re, sys
INC = '<script defer src="/tb-consent.js" data-ga="G-1XZK7XBL67"></script>'
gtag = re.compile(r'<script async src="https://www\.googletagmanager\.com/gtag/js\?id=G-1XZK7XBL67"></script>\s*<script>.*?</script>', re.S)
for f in sys.argv[1:]:
    s = open(f).read()
    n = len(gtag.findall(s))
    if n:
        s = gtag.sub(INC, s)
    elif 'tb-consent.js' not in s:
        s = s.replace('</head>', INC + '\n</head>', 1)
    assert s.count('tb-consent.js') == 1, f
    open(f, 'w').write(s)
    print(f, n)
