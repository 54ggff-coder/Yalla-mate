with open('src/App.tsx', 'r') as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if "const executeTransactionalOp =" in line:
        print("Def found at", i)
        for j in range(i, min(i+50, len(lines))):
            print(f"{j+1}: {lines[j].rstrip()}")
        break

