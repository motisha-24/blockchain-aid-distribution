import os

file_path = "dashboard/src/pages/NGODashboard.js"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

fixed_content = content.replace('\\"', '"')

with open(file_path, "w", encoding="utf-8") as f:
    f.write(fixed_content)

print("Fixed backslashes in NGODashboard.js")
