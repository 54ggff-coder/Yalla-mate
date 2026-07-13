import re

with open('src/App.tsx', 'r') as f:
    content = f.read()

# Replace the initial channel creation
new_content = re.sub(
    r"const syncChannel = supabase\s*\.channel\('public:unified-realtime-channel'\)\s*\.on\('postgres_changes', \{ event: '\*', schema: 'public', table: '([^']+)' \},",
    r"const channel_\1 = supabase.channel('\1_sync').on('postgres_changes', { event: '*', schema: 'public', table: '\1' },",
    content
)

# Replace the chained .on() calls
def replacer(match):
    table = match.group(1)
    return f"      .subscribe();\n\n    const channel_{table} = supabase.channel('{table}_sync')\n      .on('postgres_changes', {{ event: '*', schema: 'public', table: '{table}' }},"

while True:
    newer_content = re.sub(
        r"      \}\)\s*\.on\('postgres_changes', \{ event: '\*', schema: 'public', table: '([^']+)' \},",
        replacer,
        new_content,
        count=1
    )
    if newer_content == new_content:
        break
    new_content = newer_content

with open('src/App.tsx', 'w') as f:
    f.write(new_content)

