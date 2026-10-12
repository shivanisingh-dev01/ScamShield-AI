from brand_intelligence import check_brand_impersonation, catalog_stats

cases = [
    ("sbi.bank.com", True),
    ("www.sbi.bank.in", False),
    ("paypal-login.example.com", True),
    ("paypa1.example.com", True),
    ("g00gle.example.com", True),
    ("www.google.com", False),
    ("random-unknown.example.com", False),
    ("hdfc-login.example.com", True),
]
print('Catalog:', catalog_stats())
for host, expected in cases:
    result = check_brand_impersonation(host)
    print(host, ':', result)
    assert bool(result) == expected, (host, result, expected)
print('All catalog tests passed')
