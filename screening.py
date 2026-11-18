"""Deterministic fictional resident intake workflow for LoopLogic.

Not an eligibility decision engine. Questions are intake prompts and do NOT encode
verified program thresholds or assert that a response qualifies/disqualifies.
State is provided by the browser on each request; no server-side resident records.
"""
import re

PROGRAMS = {
    'rent': {
        'title': 'Canada–Nova Scotia Rent Supplement',
        'trigger': re.compile(r'\b(rent supplement|rental supplement|housing benefit|screen(?:ing)? for rent|qualif(?:y|ication).*rent|apply for (?:the )?rent)\b', re.I),
        'fields': [
            ('resident_ns', 'Do you currently live in Nova Scotia? (yes/no/unsure)', 'yesno'),
            ('housing_type', 'Do you currently rent your home, own it, or have another housing arrangement? (rent/own/other/unsure)', 'housing'),
            ('immigration_status', 'For program screening, which best describes your current status: Canadian citizen, permanent resident, protected person, temporary resident, other, or prefer not to say?', 'status'),
            ('household_size', 'How many people, including you, live in your household? (a number or unsure)', 'number'),
            ('monthly_rent', 'Approximately how much is your monthly rent in Canadian dollars? (a number or prefer not to say)', 'money'),
            ('household_income', 'Approximately what is your total household income before tax per year, in Canadian dollars? (a number or prefer not to say)', 'money'),
        ],
        'source': 'https://www.novascotia.ca/apply-rent-supplement-canada-nova-scotia-targeted-housing-benefit',
    },
}


def parse_answer(value, kind):
    value = str(value or '').strip()
    low = value.lower().strip('.! ')
    if not value or len(value) > 480:
        return None
    if low in ('unsure', 'not sure', "don't know", 'i don\'t know', 'prefer not to say', 'skip'):
        return 'unknown'
    if kind == 'yesno':
        if low in ('yes', 'y', 'yeah', 'i do', 'correct'): return 'yes'
        if low in ('no', 'n', 'i do not', "i don't"): return 'no'
    if kind == 'housing':
        if re.search(r'\b(rent|renter|tenant|lease)\b', low): return 'rent'
        if re.search(r'\b(own|owner|homeowner)\b', low): return 'own'
        if low in ('other','another arrangement'): return 'other'
    if kind == 'status':
        if 'permanent resident' in low or low in ('pr', 'i am a pr'): return 'permanent resident'
        if 'protected person' in low: return 'protected person'
        if 'temporary resident' in low or 'work permit' in low or 'study permit' in low: return 'temporary resident'
        if 'citizen' in low: return 'citizen'
        if low == 'other': return 'other'
    if kind in ('money','number'):
        # Accept plain numbers with currency symbols/commas; avoid guessing ranges.
        candidate = re.sub(r'[,$\s]', '', low)
        if re.fullmatch(r'\d+(?:\.\d{1,2})?', candidate):
            n = float(candidate)
            if (kind == 'number' and 1 <= n <= 30 and n.is_integer()) or (kind == 'money' and 0 <= n <= 10000000):
                return int(n) if n.is_integer() else n
    return None


def next_question(session):
    program = PROGRAMS[session['program']]
    answers = session['answers']
    for idx, (key, question, _) in enumerate(program['fields']):
        if key not in answers:
            return {'status': 'in_progress', 'program': session['program'], 'session': session,
                    'question': question, 'field': key, 'completed': len(answers), 'total': len(program['fields']),
                    'text': f"{program['title']} — intake question {idx+1}/{len(program['fields'])}:\n{question}"}
    session['status'] = 'complete'
    summary = '\n'.join(f'- {key.replace("_", " ").title()}: {answers[key]}' for key, _, _ in program['fields'])
    return {'status': 'complete', 'program': session['program'], 'session': session,
            'completed': len(answers), 'total': len(program['fields']),
            'text': f"Intake complete for {program['title']}.\n\n{summary}\n\nThis is only an information-gathering checklist, NOT an eligibility determination. Some answers may need clarification, and additional official criteria may apply. Check the current requirements and application process:\n{program['source']}\n\nYou can say 'restart screening' to begin again."}


def handle(message, session=None, program=None):
    """Return dict, or None if unrelated and no active screening."""
    message = str(message or '').strip()
    active = isinstance(session, dict) and session.get('status') == 'in_progress' and session.get('program') in PROGRAMS
    if re.search(r'\b(cancel|stop) screening\b', message, re.I) and active:
        return {'status':'cancelled', 'session': None, 'text':'The screening was cancelled. No screening answers were kept in this demo session.'}
    if re.search(r'\b(restart|start over|reset) screening\b', message, re.I):
        program = session.get('program') if active else (program if program in PROGRAMS else 'rent')
        session = None
        active = False
    if not active:
        if program not in PROGRAMS:
            program = next((key for key, p in PROGRAMS.items() if p['trigger'].search(message)), None)
        if not program: return None
        session = {'program': program, 'status':'in_progress', 'answers': {}}
        return next_question(session)
    # The browser owns the session; discard unknown fields and large/out-of-range answers.
    prog = PROGRAMS[session['program']]
    incoming = session.get('answers', {})
    if not isinstance(incoming, dict): incoming = {}
    answers = {k: incoming[k] for k, _, _ in prog['fields'] if k in incoming and isinstance(incoming[k], (str, int, float)) and len(str(incoming[k])) <= 80}
    session = {'program': session['program'], 'status':'in_progress', 'answers':answers}
    pending = next(((key, question, kind) for key, question, kind in prog['fields'] if key not in answers), None)
    if pending is None: return next_question(session)
    key, question, kind = pending
    parsed = parse_answer(message, kind)
    if parsed is None:
        return {'status':'in_progress','session':session, 'program':session['program'], 'field':key,
                'completed':len(answers),'total':len(prog['fields']),
                'text':f"I couldn't reliably interpret that answer. Please choose one of the options, or say 'unsure' to continue.\n{question}"}
    answers[key] = parsed
    return next_question(session)
