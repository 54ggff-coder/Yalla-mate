with open('src/App.tsx', 'r') as f:
    c = f.read()
    
c = c.replace('      })\n      })\n      .subscribe();', '      })\n      .subscribe();')

# Also fix the cleanup function
c = c.replace('supabase.removeChannel(syncChannel);', '''
      supabase.removeChannel(channel_reels);
      supabase.removeChannel(channel_reels_bookmarks);
      supabase.removeChannel(channel_reels_comments);
      supabase.removeChannel(channel_reels_likes);
      supabase.removeChannel(channel_users);
      supabase.removeChannel(channel_outings);
      supabase.removeChannel(channel_follows);
      supabase.removeChannel(channel_friend_requests);
''')

with open('src/App.tsx', 'w') as f:
    f.write(c)

