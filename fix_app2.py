import re

with open('src/App.tsx', 'r') as f:
    c = f.read()

c = c.replace("""    <APIProvider apiKey={googleMapsKey}>
      <AppContent />
  ) : (""", """    <APIProvider apiKey={googleMapsKey}>
      <AppContent />
    </APIProvider>
  ) : (""")

c = c.replace("""function AppContent() {
      return (localStorage.getItem('yallamate_lang') as Language) || 'ar';
  });""", """function AppContent() {
  const [lang, setLang] = useState<Language>(() => {
    return (localStorage.getItem('yallamate_lang') as Language) || 'ar';
  });""")

with open('src/App.tsx', 'w') as f:
    f.write(c)
