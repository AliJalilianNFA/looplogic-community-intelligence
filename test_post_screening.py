import unittest
from screening import handle
from post_screening import build_plan, OFFICIAL_URL


def run(answers):
    result = handle('Please screen me for the Canada–Nova Scotia Rent Supplement')
    for value in answers:
        result = handle(value, result['session'])
    return result


class PostScreeningTests(unittest.TestCase):
    def setUp(self):
        self.completed = run(['yes', 'rent', 'permanent resident', '3', '2300', '48000'])

    def test_accurate_affordability_indicator_not_eligibility(self):
        plan = build_plan(self.completed['session'])
        self.assertEqual(plan['metrics']['actual_rent_to_income_pct'], 57.5)
        self.assertEqual(plan['metrics']['household_size'], 3)
        self.assertEqual(plan['metrics']['monthly_rent'], 2300)
        self.assertEqual(plan['source_url'], OFFICIAL_URL)
        self.assertIn('average market rent', plan['interpretation'].lower())
        self.assertNotIn('eligible', plan['label'].lower())
        self.assertTrue(all(t['url'].startswith('https://') for t in plan['tasks']))
        self.assertEqual(len({t['id'] for t in plan['tasks']}), len(plan['tasks']))

    def test_no_ratio_when_missing_income(self):
        completed = run(['yes', 'rent', 'permanent resident', '3', '2300', 'prefer not to say'])
        plan = build_plan(completed['session'])
        self.assertIsNone(plan['metrics']['actual_rent_to_income_pct'])
        self.assertTrue(any('missing' in s for s in plan['review_notes']))

    def test_own_home_needs_alternative_review(self):
        completed = run(['yes', 'own', 'permanent resident', '3', '2300', '48000'])
        plan = build_plan(completed['session'])
        self.assertTrue(any(x['id'] == 'homeowner-alternative' for x in plan['tasks']))
        self.assertTrue(any('owning' in note for note in plan['review_notes']))

    def test_zero_income_is_undefined(self):
        completed = run(['yes', 'rent', 'permanent resident', '3', '2300', '0'])
        plan = build_plan(completed['session'])
        self.assertIsNone(plan['metrics']['actual_rent_to_income_pct'])

    def test_incomplete_or_incorrect_session_rejected(self):
        self.assertIsNone(build_plan({'program': 'rent', 'status': 'in_progress', 'answers': {}}))
        self.assertIsNone(build_plan({'program': 'rent', 'status': 'complete', 'answers': {}}))
        self.assertIsNone(build_plan({'program': 'harp', 'status': 'complete', 'answers': {}}))
        self.assertIsNone(build_plan({'program': 'rent', 'status': 'complete', 'answers': {
            'resident_ns': 'yes', 'housing_type': 'rent', 'immigration_status': 'permanent resident',
            'household_size': 3, 'monthly_rent': 'nan', 'household_income': '48000'
        }})['metrics']['actual_rent_to_income_pct'])


if __name__ == '__main__':
    unittest.main()
