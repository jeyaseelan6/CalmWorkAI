import json

with open('scratch/fde_corpus/fde_blogs_extracted.json', 'r', encoding='utf-8') as f:
    blogs = json.load(f)

print(f"Total blogs analyzed: {len(blogs)}")
for i, b in enumerate(blogs):
    print(f"{i+1}. {b['title']}")
    print(f"   Desc: {b['desc'][:120]}...")
    if b.get('headings'):
        print(f"   Headings: {', '.join(b['headings'][:4])}")
    print()
