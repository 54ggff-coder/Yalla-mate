with open('src/App.tsx', 'r') as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if line.strip() == "<AppContent />" and lines[i+1].strip() == ") : (":
        lines.insert(i+1, "    </APIProvider>\n")

# And we need to fix the `AppContent` start because `const [lang, setLang]...` was deleted
for i, line in enumerate(lines):
    if line.strip() == "function AppContent() {":
        if "return (localStorage" in lines[i+1]:
            lines.insert(i+1, "  const [lang, setLang] = useState<Language>(() => {\n")

with open('src/App.tsx', 'w') as f:
    f.writelines(lines)

