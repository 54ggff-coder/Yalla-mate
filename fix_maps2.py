import re

with open('src/App.tsx', 'r') as f:
    c = f.read()

# Add APIProvider import if not there
if "APIProvider" not in c:
    c = c.replace("import SocialHub", "import { APIProvider } from '@vis.gl/react-google-maps';\nimport SocialHub")

# Wrap AppContent in App
app_start = c.find("export default function App() {")
app_end = c.find("function AppContent() {")
if app_start != -1:
    old_app = c[app_start:app_end]
    new_app = """export default function App() {
  const [googleMapsKey, setGoogleMapsKey] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/maps/config')
      .then(res => res.json())
      .then(data => {
        if (data.apiKey) setGoogleMapsKey(data.apiKey);
      })
      .catch(err => console.error('Failed to load map config:', err));
  }, []);

  return googleMapsKey ? (
    <APIProvider apiKey={googleMapsKey}>
      <AppContent />
    </APIProvider>
  ) : (
    <AppContent />
  );
}

"""
    c = c[:app_start] + new_app + c[app_end:]

with open('src/App.tsx', 'w') as f:
    f.write(c)

