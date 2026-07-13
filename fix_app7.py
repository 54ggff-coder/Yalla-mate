import re

with open('src/App.tsx', 'r') as f:
    c = f.read()

c = re.sub(r"function AppContent\(\) \{\s*return \(localStorage\.getItem\('yallamate_lang'\) as Language\) \|\| 'ar';\s*\}\);", """function AppContent() {
  const [lang, setLang] = useState<Language>(() => {
    return (localStorage.getItem('yallamate_lang') as Language) || 'ar';
  });""", c)

with open('src/App.tsx', 'w') as f:
    f.write(c)

