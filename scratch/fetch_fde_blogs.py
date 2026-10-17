import urllib.request
import re
import json
import os
import time

urls = [
    'https://fde.academy/blog/why-forward-deployed-engineers-fdes-are-in-high-demand',
    'https://fde.academy/blog/why-every-ai-startup-needs-a-forward-deployed-engineer',
    'https://fde.academy/blog/why-ai-agents-are-changing-the-forward-deployed-engineer-role',
    'https://fde.academy/blog/mistakes-new-forward-deployed-engineers-make',
    'https://fde.academy/blog/forward-deployed-engineer-responsibilities',
    'https://fde.academy/blog/why-do-forward-deployed-engineers-travel',
    'https://fde.academy/blog/will-ai-replace-forward-deployed-engineers',
    'https://fde.academy/blog/do-forward-deployed-engineers-actually-work-remotely',
    'https://fde.academy/blog/what-problems-do-forward-deployed-engineers-solve',
    'https://fde.academy/blog/how-do-forward-deployed-engineers-improve-ai-roi',
    'https://fde.academy/blog/future-of-forward-deployed-engineers',
    'https://fde.academy/blog/what-are-the-biggest-risks-forward-deployed-engineers-face',
    'https://fde.academy/blog/a-beginners-guide-to-forward-deployed-engineers',
    'https://fde.academy/blog/habits-of-successful-forward-deployed-engineers',
    'https://fde.academy/blog/benefits-of-hiring-forward-deployed-engineers-for-enterprise-ai',
    'https://fde.academy/blog/how-are-forward-deployed-engineers-evaluated',
    'https://fde.academy/blog/ai-governance-for-forward-deployed-engineers',
    'https://fde.academy/blog/what-makes-a-successful-forward-deployed-engineer',
    'https://fde.academy/blog/how-forward-deployed-engineers-improve-customer-retention',
    'https://fde.academy/blog/ai-workflow-automation-forward-deployed-engineers',
    'https://fde.academy/blog/which-ai-use-cases-are-best-suited-for-forward-deployed-engineers',
    'https://fde.academy/blog/which-industries-need-forward-deployed-engineers-the-most',
    'https://fde.academy/blog/fde-project-lifecycle-from-discovery-to-deployment',
    'https://fde.academy/blog/what-is-palantir-foundry',
    'https://fde.academy/blog/why-enterprise-ai-adoption-fails',
    'https://fde.academy/blog/ai-implementation-engineer',
    'https://fde.academy/blog/solo-fde-vs-working-on-an-fde-team',
    'https://fde.academy/blog/forward-deployed-engineering-in-healthcare-ai',
    'https://fde.academy/blog/google-forward-deployed-engineer-interview-questions',
    'https://fde.academy/blog/forward-deployed-engineer-training',
    'https://fde.academy/blog/how-fdes-help-enterprises-deploy-ai',
    'https://fde.academy/blog/what-technical-skills-does-an-fde-need',
    'https://fde.academy/blog/what-is-the-fde-work-cycle',
    'https://fde.academy/blog/mcp-for-fdes-connecting-ai-to-enterprise-systems-lxwp1',
    'https://fde.academy/blog/ai-in-manufacturing-how-forward-deployed-engineers-deploy-it',
    'https://fde.academy/blog/llm-guardrails-and-human-in-the-loop-design',
    'https://fde.academy/blog/ai-data-pipelines-for-messy-enterprise-data-a-practical-guide-for-fdes',
    'https://fde.academy/blog/ai-in-banking-how-forward-deployed-engineers-deploy-it',
    'https://fde.academy/blog/palantir-aip-explained-what-it-is-and-how-fdes-use-it',
    'https://fde.academy/blog/data-cleaning-for-ai-projects-methods-fdes-use-on-messy-customer-data'
]

os.makedirs('scratch/fde_corpus', exist_ok=True)
print(f"Starting extraction for {len(urls)} URLs...")

results = []
for i, url in enumerate(urls):
    slug = url.split('/')[-1]
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'})
        with urllib.request.urlopen(req, timeout=12) as resp:
            html = resp.read().decode('utf-8', errors='ignore')
            
            title_m = re.search(r'<title>(.*?)</title>', html, re.I)
            title = title_m.group(1).replace(' - FDE Academy', '').strip() if title_m else slug
            
            desc_m = re.search(r'<meta content="([^"]+)" name="description"', html, re.I)
            desc = desc_m.group(1) if desc_m else ''
            
            # Extract rich text body
            body_m = re.search(r'class="[^"]*toc_richtext[^"]*"[^>]*>(.*?)</div>\s*</div>', html, re.S)
            body_text = ''
            if body_m:
                raw_body = body_m.group(1)
                body_text = re.sub(r'<[^>]+>', ' ', raw_body)
                body_text = re.sub(r'\s+', ' ', body_text).strip()
            
            # Extract H2/H3 subheadings
            headings = re.findall(r'<h[23][^>]*>(.*?)</h[23]>', html, re.I)
            clean_headings = [re.sub(r'<[^>]+>', '', h).strip() for h in headings if len(re.sub(r'<[^>]+>', '', h).strip()) > 3]
            
            summary = {
                'slug': slug,
                'title': title,
                'desc': desc,
                'headings': clean_headings[:10],
                'body_length': len(body_text),
                'content_snippet': body_text[:1500] if body_text else ''
            }
            results.append(summary)
            print(f"[{i+1}/{len(urls)}] OK: {slug} ({len(body_text)} chars)")
    except Exception as e:
        print(f"[{i+1}/{len(urls)}] ERR: {slug} -> {e}")
    time.sleep(0.3)

with open('scratch/fde_corpus/fde_blogs_extracted.json', 'w', encoding='utf-8') as f:
    json.dump(results, f, indent=2)

print("Finished! Saved all extracted FDE blogs to scratch/fde_corpus/fde_blogs_extracted.json")
