import re

with open('src/App.tsx', 'r') as f:
    c = f.read()

# Let's find export default function App
app_match = re.search(r"export default function App\(\) \{.*?(function AppContent\(\) \{)", c, re.DOTALL)
if app_match:
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
    c = c[:app_match.start()] + new_app + c[app_match.end(1)-23:]

with open('src/App.tsx', 'w') as f:
    f.write(c)

