import re

with open('server.ts', 'r') as f:
    content = f.read()

# Lines to remove:
content = re.sub(r"\s*tools:\s*\[\{\s*googleSearch:\s*\{\}\s*\}\],.*?\n", "\n", content)
content = re.sub(r"\s*tools:\s*\[\{\s*googleSearch:\s*\{\}\s*\}\]\n", "\n", content)

with open('server.ts', 'w') as f:
    f.write(content)

