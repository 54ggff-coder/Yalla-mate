import re

with open('src/App.tsx', 'r') as f:
    c = f.read()

# Add import
if "APIProvider" not in c:
    c = c.replace("import SocialHub", "import { APIProvider } from '@vis.gl/react-google-maps';\nimport SocialHub")

# Remove old API_KEY
c = re.sub(r"const API_KEY =.*?'';\nconst hasValidKey = Boolean\(API_KEY\) && API_KEY !== 'YOUR_API_KEY';\n", "", c, flags=re.DOTALL)

# In AppContent, add state and fetch
app_content_start = c.find("function AppContent() {")
app_content_end = c.find("const [lang, setLang] = useState<Language>")
if app_content_start != -1:
    new_state = """
  const [googleMapsKey, setGoogleMapsKey] = useState<string | null>(null);
  useEffect(() => {
    fetch('/api/maps/config')
      .then(res => res.json())
      .then(data => {
        if (data.apiKey) setGoogleMapsKey(data.apiKey);
      })
      .catch(err => console.error('Failed to load map config:', err));
  }, []);
  
  """
    c = c[:app_content_end] + new_state + c[app_content_end:]

# Wrap the render return with APIProvider if googleMapsKey is available
return_start = c.find("return (", app_content_start)
return_end = c.find("  );\n}", return_start)
if return_start != -1 and "APIProvider" not in c[return_start:return_end]:
    # It might be hard to safely wrap the entire app, let's wrap just the inner div or the whole return
    c = c.replace(
        """return (
    <div className={`min-h-screen""",
        """return (
    <APIProvider apiKey={googleMapsKey || ''}>
    <div className={`min-h-screen"""
    )
    c = c.replace(
        """    </div>
  );
}""",
        """    </div>
    </APIProvider>
  );
}"""
    )

with open('src/App.tsx', 'w') as f:
    f.write(c)

