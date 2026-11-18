import unittest
from screening import handle

class ScreeningTests(unittest.TestCase):
    def test_multi_turn_continuity(self):
        r = handle('Please screen me for the rent supplement')
        self.assertEqual(r['field'], 'resident_ns')
        fields = ['housing_type','immigration_status','household_size','monthly_rent','household_income']
        for answer, field in zip(['yes','rent','I am a permanent resident','3','1500','42000'], fields + [None]):
            r = handle(answer, r['session'])
            if field:
                self.assertEqual(r['field'], field)
        self.assertEqual(r['status'], 'complete')
        self.assertEqual(r['session']['answers']['immigration_status'], 'permanent resident')
        self.assertIn('NOT an eligibility determination', r['text'])

    def test_invalid_answer_does_not_advance(self):
        r = handle('apply for the rent supplement')
        bad = handle('maybe next year', r['session'])
        self.assertEqual(bad['completed'], 0)
        self.assertEqual(bad['field'], 'resident_ns')

    def test_cancel_and_restart(self):
        r = handle('rent supplement')
        r = handle('yes', r['session'])
        x = handle('restart screening', r['session'])
        self.assertEqual(x['completed'], 0)
        x = handle('cancel screening', x['session'])
        self.assertEqual(x['status'], 'cancelled')
        self.assertIsNone(x['session'])

    def test_does_not_hijack_normal_requests(self):
        self.assertIsNone(handle('Find food support in Bedford'))

if __name__ == '__main__':
    unittest.main()
