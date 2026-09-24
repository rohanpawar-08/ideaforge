import requests

def verify():
    res = requests.get('http://127.0.0.1:8000/roadmaps')
    assert res.status_code == 200, f"Failed: {res.status_code}"
    items = res.json()
    print(f"Total roadmaps in history: {len(items)}")
    
    for item in items[:4]:
        print(f"- ID {item['id']}: {item['original_idea'][:50]} | Feasibility: {item['summary']['feasibility']} | {item['summary']['estimated_weeks']} weeks | Created: {item['created_at']}")

    # Verify loading the full roadmap for the top 3 items
    for item in items[:3]:
        r = requests.get(f"http://127.0.0.1:8000/roadmaps/{item['id']}")
        assert r.status_code == 200, f"Failed to get full roadmap {item['id']}"
        data = r.json()
        assert "data" in data, "No 'data' in roadmap response"
        assert "milestones" in data["data"], "No 'milestones' in data"
        print(f"Verified full roadmap ID {item['id']} successfully loaded ({len(data['data']['milestones'])} milestones)")

if __name__ == '__main__':
    verify()
