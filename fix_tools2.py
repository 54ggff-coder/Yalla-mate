import re

with open('server.ts', 'r') as f:
    c = f.read()

c = c.replace("""          config: {
            systemInstruction,
          }""", """          config: {
            systemInstruction,
            tools: [{ googleSearch: {} }],
          }""")

c = c.replace("""          config: {
          }
        });
        
        const textOutput = response.text || '';""", """          config: {
            tools: [{ googleSearch: {} }],
          }
        });
        
        const textOutput = response.text || '';""")

with open('server.ts', 'w') as f:
    f.write(c)

