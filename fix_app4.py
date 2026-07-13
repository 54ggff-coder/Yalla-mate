with open('src/App.tsx', 'r') as f:
    c = f.read()

c = c.replace("""    <APIProvider apiKey={googleMapsKey}>
      <AppContent />
  ) : (""", """    <APIProvider apiKey={googleMapsKey}>
      <AppContent />
    </APIProvider>
  ) : (""")

with open('src/App.tsx', 'w') as f:
    f.write(c)

