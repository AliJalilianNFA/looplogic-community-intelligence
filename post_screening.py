"""Deterministic post-intake plan for the fictional Canada–Nova Scotia Rent Supplement demo.

NOT an eligibility determination, benefit quote, or official government calculation.
No documents or identifiers are collected, and no external API is called.
The government's eligibility calculation uses local average market rent (AMR), not the
resident's reported actual rent / gross-income ratio calculated here.
"""

from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from screening import PROGRAMS

OFFICIAL_URL = PROGRAMS['rent']['source']
GUIDE_URL = 'https://www.novascotia.ca/documents/canada-nova-scotia-targeted-housing-benefit-renter-guide'
SOURCE_CHECKED = '2026-11-16'
REQUIRED_KEYS = tuple(field[0] for field in PROGRAMS['rent']['fields'])


def _number(value):
    """Return a safe finite nonnegative Decimal or None for unknown/invalid input."""
    if isinstance(value, bool) or value is None or str(value).strip().lower() == 'unknown':
        return None
    try:
        d = Decimal(str(value))
    except (InvalidOperation, ValueError):
        return None
    if not d.is_finite() or not (Decimal('0') <= d <= Decimal('10000000')):
        return None
    return d


def _money(value):
    return '${:,.0f}'.format(value)


def build_plan(session):
    """Generate review indicators and stable tasks from a completed demo intake."""
    if not isinstance(session, dict) or session.get('program') != 'rent' or session.get('status') != 'complete':
        return None
    a = session.get('answers')
    if not isinstance(a, dict) or any(k not in a for k in REQUIRED_KEYS):
        return None

    rent = _number(a.get('monthly_rent'))
    income = _number(a.get('household_income'))
    ratio = None
    if rent is not None and income is not None and income > 0:
        ratio = float((rent * 12 / income * 100).quantize(Decimal('0.1'), rounding=ROUND_HALF_UP))

    household = a.get('household_size')
    if not isinstance(household, int) or isinstance(household, bool) or not 1 <= household <= 30:
        household = None

    signals = []
    if a.get('housing_type') == 'own':
        signals.append('You reported owning your home. This renter-focused stream may not be appropriate; check the separate homeowner supplement.')
    elif a.get('housing_type') != 'rent':
        signals.append('Your rental arrangement needs clarification before considering renter-program requirements.')
    if a.get('resident_ns') != 'yes':
        signals.append('Nova Scotia residence is an eligibility condition. Confirm your residence before applying.')
    if a.get('immigration_status') == 'unknown':
        signals.append('Your immigration status was not provided; verify accepted categories on the official page.')
    if a.get('immigration_status') in ('temporary resident', 'protected person', 'other'):
        signals.append('Your reported immigration category needs confirmation against the current program rules. Do not assume eligibility.')
    if rent is None or income is None:
        signals.append('Rent or gross household income is missing; the illustrative rent-to-income ratio cannot be calculated.')
    if income == 0 and rent is not None:
        signals.append('Gross household income was entered as $0; the rent-to-income ratio is undefined.')
    if household is None:
        signals.append('Household size is unknown; official benefit calculations depend on household composition.')
    if not signals:
        signals.append('The official screening still needs average market rent, household income limits, and exclusion checks.')

    tasks = [
        {'id': 'rent-rules', 'priority': 'First', 'title': 'Verify the official renter-program criteria',
         'detail': 'Review current income limits, local average market rent, eligible rental type, and exclusions including public housing, other rent subsidies, and existing supplements.',
         'url': OFFICIAL_URL},
        {'id': 'rent-income', 'priority': 'Prepare', 'title': 'Prepare household income evidence',
         'detail': 'The official application asks for gross income evidence for household members aged 18 or older who are not in school. Confirm what applies to your household.',
         'url': OFFICIAL_URL},
        {'id': 'rent-lease', 'priority': 'Prepare', 'title': 'Find your lease or rent increase letter',
         'detail': 'If available, prepare a lease or rent increase letter showing the rental address. The official program also describes options for applicants without a current lease.',
         'url': OFFICIAL_URL},
        {'id': 'rent-household', 'priority': 'Check', 'title': 'Confirm household composition and school enrollment',
         'detail': 'The application may require proof of full-time enrollment for children aged 18–25; verify household composition and supporting documents.',
         'url': GUIDE_URL},
        {'id': 'rent-application', 'priority': 'Apply', 'title': 'Review and submit the official application',
         'detail': 'Use the official government portal. It may ask for SINs of adult household members—never enter those into LoopLogic. Submission requires your direct action.',
         'url': OFFICIAL_URL},
        {'id': 'rent-followup', 'priority': 'Follow up', 'title': 'Track the application and any renewal',
         'detail': 'Keep your confirmation privately. Official guidance estimates 2–3 months for review, potentially longer if more information is needed; approved recipients must renew each year.',
         'url': OFFICIAL_URL},
    ]
    if a.get('housing_type') == 'own':
        tasks.insert(1, {'id': 'homeowner-alternative', 'priority': 'Alternative',
                         'title': 'Explore the homeowner supplement instead',
                         'detail': 'If you own your home, check the separate homeowner program rather than assuming the renter stream applies.',
                         'url': 'https://www.novascotia.ca/apply-homeowners-supplement-canada-nova-scotia-targeted-housing-benefit'})

    return {
        'version': 1,
        'program': 'rent',
        'title': 'Rent Supplement — Your Next-Step Plan',
        'label': 'Preliminary intake · not a benefit decision',
        'metrics': {
            'monthly_rent': float(rent) if rent is not None else None,
            'annual_household_income': float(income) if income is not None else None,
            'household_size': household,
            'actual_rent_to_income_pct': ratio,
        },
        'interpretation': ('Your reported actual-rent-to-income ratio is an affordability indicator only. '
                           'Nova Scotia evaluates the published 40% test using average market rent in your area, '
                           'not your actual rent. No eligibility decision or payment amount is estimated here.'),
        'review_notes': signals,
        'tasks': tasks,
        'source_url': OFFICIAL_URL,
        'guide_url': GUIDE_URL,
        'source_checked': SOURCE_CHECKED,
    }
