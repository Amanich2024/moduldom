"""Regression checks for administrator publication. No network or file mutations."""
import copy
import json
import unittest
from pathlib import Path
import build


class PublicationTests(unittest.TestCase):
    def setUp(self):
        self.data = json.loads(build.DATA.read_text(encoding='utf-8'))
        # Scenario tests must not depend on the operator's current archive state.
        for group in ('projects', 'built'):
            for item in self.data[group]:
                item['status'] = 'published'

    def test_price_reaches_all_catalogs(self):
        self.data['projects'][0]['warm'] = 1000100
        build.validate(self.data)
        outputs = build.compile_pages(self.data)
        self.assertIn('1000100', outputs[Path('data/catalog.js')])
        for page in ['katalog/index.html', 'katalog/preview.html', 'index.html']:
            self.assertIn('data/catalog.js?v=', outputs[Path(page)])

    def test_add_archive_and_order_portfolio(self):
        new = copy.deepcopy(self.data['built'][0])
        new.update(id='admin-regression-object', legacyId='admin-regression-object', name='Тест нового объекта')
        self.data['built'].insert(0, new)
        self.data['built'][1]['status'] = 'archived'
        build.validate(self.data)
        outputs = build.compile_pages(self.data)
        promo = outputs[Path('promo.html')]
        self.assertIn('<h1>Тест нового объекта</h1>', promo)
        self.assertIn('data-house="admin-regression-object"', promo)
        self.assertNotIn('data-house="' + self.data['built'][1]['legacyId'] + '"', promo)
        payload = outputs[Path('data/catalog.js')].split('window.STUDIO_DATA = ', 1)[1].rsplit(';', 1)[0]
        public = json.loads(payload)
        self.assertEqual(public['built'][0]['id'], new['id'])
        self.assertNotIn(self.data['built'][1]['id'], [x['id'] for x in public['built']])

    def test_draft_not_in_public_catalog(self):
        self.data['projects'][0]['status'] = 'draft'
        output = build.compile_pages(self.data)[Path('data/catalog.js')]
        public = json.loads(output.split('window.STUDIO_DATA = ', 1)[1].rsplit(';', 1)[0])
        self.assertNotIn(self.data['projects'][0]['id'], [x['id'] for x in public['projects']])

    def test_reject_invalid_publication(self):
        for mutation in [
            lambda d: d['projects'][0].update(warm=-1),
            lambda d: d['projects'][0].update(fin=0),
            lambda d: d['built'][0].update(cover='../../missing'),
            lambda d: d['built'][0].update(caps=[]),
            lambda d: d['contacts'].update(write='javascript:alert(1)'),
            lambda d: [h.update(status='archived') for h in d['built']],
        ]:
            sample = copy.deepcopy(self.data)
            mutation(sample)
            with self.assertRaises(ValueError):
                build.validate(sample)


if __name__ == '__main__':
    unittest.main()
