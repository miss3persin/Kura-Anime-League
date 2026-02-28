from pathlib import Path
lines = Path('src/app/api/hype/refresh/route.ts').read_text().splitlines()
for i,line in enumerate(lines, start=1):
    print(f'{i}: {line}')
