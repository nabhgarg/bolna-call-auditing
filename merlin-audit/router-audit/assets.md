# Assets — source material referenced by prompts.csv

Paste the relevant block INTO the prompt where the prompt says `[ASSET:X]`.
The **Ground truth** section at the bottom is for graders only — never paste it into Merlin.

---

> NOTE: CODE1–CODE7 are RESERVE assets — the coding category was dropped from the
> current run (writing + summarization). Keep for a future coding module.

## CODE1 (reserve) — O(n²) snippet to refactor

```python
def find_pairs(nums, target):
    pairs = []
    for i in range(len(nums)):
        for j in range(len(nums)):
            if i != j and nums[i] + nums[j] == target:
                pairs.append((nums[i], nums[j]))
    return pairs
```

## CODE2 (for C12) — buggy function

```python
def last_n_average(values, n):
    """Return the average of the last n values."""
    total = 0
    for i in range(len(values) - n, len(values) - 1):
        total += values[i]
    return total / n
```

## CODE3 (for C21) — race condition

```python
import threading

total = 0

def add_sales(sales):
    global total
    for s in sales:
        current = total
        current += s
        total = current

threads = [threading.Thread(target=add_sales, args=([1] * 100000,)) for _ in range(4)]
[t.start() for t in threads]
[t.join() for t in threads]
print(total)  # expected 400000, often prints less
```

## CODE4 (for C08) — error to explain

```python
inventory = {"laptop": 12, "mouse": 40}
order_items = ["laptop", "keyboard", "mouse"]

for item in order_items:
    print(item, "stock left:", inventory[item] - 1)
```
```
Traceback (most recent call last):
  File "stock.py", line 5, in <module>
    print(item, "stock left:", inventory[item] - 1)
KeyError: 'keyboard'
```

## CODE5 (for C20) — broken error handling

```javascript
async function loadDashboard(userIds) {
  try {
    const users = await Promise.all(userIds.map(id => fetch(`/api/users/${id}`)));
    return users.map(u => u.json());
  } catch (e) {
    console.log("one user failed, ignoring");
    return [];
  }
}
// Requirement: one failed user should not blank the whole dashboard,
// but with this code it does — and there's a second bug in the return value.
```

## CODE6 (for C29) — memory leak

```python
_cache = {}

def get_recommendations(request):
    # request.filters is a dict like {"cat": "shoes", "max": 200}
    key = str(request)           # request objects include a unique request_id
    if key not in _cache:
        _cache[key] = expensive_model_call(request.filters)
    return _cache[key]
```

## CODE7 (for C30) — slow pandas

```python
def label_row(row):
    if row["revenue"] > 10000 and row["region"] == "APAC":
        return "priority"
    elif row["revenue"] > 10000:
        return "standard-high"
    elif row["churned"]:
        return "lost"
    else:
        return "standard"

df["label"] = df.apply(label_row, axis=1)   # 2M rows, takes minutes
```

---

## TEXT1 (for S07, S11, S20, S22, S27) — internal meeting transcript

> **Project Falcon sync — 14 October, 2:00 pm. Present: Nadia (PM), Tomas (Platform lead), Rhea (CFO), Sanjay (Security), Lena (Design).**
>
> Nadia opened with the schedule: launch moves from 1 November to 25 November. She gave two reasons — the vendor API migration slipped when Corely deprecated their v2 endpoints early, and the security review is still open. Sanjay confirmed the security review started 30 September and, per his note, was completed on 12 October, but the report writing continues and sign-off is expected by 20 October.
>
> Tomas raised the budget concern on behalf of the platform team: the Corely migration burns roughly 40 engineer-days that were never scoped, and he asked whether Q4 hiring absorbs it. Rhea responded that there is a company-wide headcount freeze through January and no exceptions. Earlier in the meeting, however, when Nadia listed mitigations, Rhea had approved bringing in two Corely-certified contractors starting next week to accelerate the migration.
>
> Decisions: launch date is now 25 November; the beta cohort shrinks from 400 to 150 users; the pricing experiment is deferred to December.
>
> Action items: Tomas to deliver the migration plan by 18 October. Sanjay to circulate the security report by 20 October. Lena to re-cut the onboarding flow for the smaller cohort by 24 October. Nadia to inform beta users by 16 October.
>
> Open questions: whether the December pricing experiment needs legal review, and who owns the contractor budget line given the freeze.

## TEXT2 (for S08, S10, S15, S21, S24, S27) — public company statement

> **Statement from Corely, Inc. — 21 October**
>
> Following the service disruption of 8 October, we are publishing our remediation commitments. We know that dependable delivery is why customers choose Corely, and two missed deliveries in one quarter fall short of that standard.
>
> First, we will complete the migration of all customers off the v2 endpoints by 30 November. Second, an independent audit of our deprecation process will begin on 5 November and its findings will be published in full by 15 December. Third, we are committing to a 99.95% uptime SLA, effective 1 January, with service credits applied automatically rather than by request. Fourth, all enterprise customers will receive a dedicated delivery report each month, with the first delivery scheduled for 8 December. Fifth, we will hire a VP of Reliability, with the search concluding by 31 January.
>
> We also want to correct the record on our internal security review, which some customers have asked about: that review was substantially complete on 15 October, and no customer data was affected at any point.
>
> We recognize that a statement is not a fix. The delivery of these commitments — not this document — is what we should be judged on.

## TEXT3 (reserved — use for golden items) — messy contact block

> Reach out anytime! Project leads: Nadia Iyer (Program Manager) nadia.iyer@corely.com, +91 98200 11223. Platform side it's Tomas Vrba — tomas.vrba@corely.com. Security questions go to sanjay.mehta@corely.com (Sanjay Mehta, Head of Security, desk +91 22 6600 4455). For design, Lena Fischer lena.f@corely.com. Finance/billing: Rhea Kapoor CFO — use rhea.kapoor@corely.com or her assistant Priya at priya.nair@corely.com (+91 99300 55667). Media: press@corely.com. If all else fails the old support alias still works: help@corely-support.com.

## DATA1 (for S09, S17, S18, S29) — personnel CSV, 62 rows

```csv
name,dept,age,company,email
Aarav Sharma,Engineering,26,Acme Corp,aarav.sharma@acmecorp.com
Bianca Rodrigues,Engineering,29,Acme Corp,bianca.rodrigues@acmecorp.com
Chetan Iyer,Engineering,31,Brightline,chetan.iyer@brightline.io
Divya Nair,Engineering,34,Acme Corp,divya.nair@acmecorp.com
Elias Fernandes,Engineering,28,Cloudnine,elias.fernandes@cloudnine.in
Farah Khan,Engineering,42,Brightline,farah.khan@brightline.io
Gaurav Menon,Engineering,37,Acme Corp,gaurav.menon@brightline.io
Hina Patel,Engineering,25,Cloudnine,hina.patel@cloudnine.in
Ishaan Reddy,Engineering,30,Brightline,ishaan.reddy@brightline.io
Jaya Bose,Engineering,33,Acme Corp,jaya.bose@acmecorp.com
Kunal Joshi,Engineering,27,Cloudnine,kunal.joshi@cloudnine.in
Lakshmi Rao,Engineering,36,Brightline,lakshmi.rao@brightline.io
Manav Gupta,Engineering,38,Acme Corp,manav.gupta@acmecorp.com
Nisha Verma,Engineering,24,Cloudnine,nisha.verma@cloudnine.in
Omar Sheikh,Sales,28,Acme Corp,omar.sheikh@acmecorp.com
Pooja Desai,Sales,31,Brightline,pooja.desai@brightline.io
Qasim Ali,Sales,34,Acme Corp,qasim.ali@acmecorp.com
Ritika Singh,Sales,29,Cloudnine,ritika.singh@acmecorp.com
Sameer Kulkarni,Sales,42,Brightline,sameer.kulkarni@brightline.io
Tanvi Shah,Sales,37,Acme Corp,tanvi.shah@acmecorp.com
Uday Pillai,Sales,25,Cloudnine,uday.pillai@cloudnine.in
Vani Krishnan,Sales,33,Brightline,vani.krishnan@brightline.io
Wasim Baig,Sales,30,Acme Corp,wasim.baig@acmecorp.com
Xavier D'Souza,Sales,36,Brightline,xavier.dsouza@brightline.io
Yamini Chawla,Sales,27,Cloudnine,yamini.chawla@cloudnine.in
Zoya Ansari,Sales,32,Acme Corp,zoya.ansari@acmecorp.com
Aditi Bhatt,Marketing,27,Acme Corp,aditi.bhatt@acmecorp.com
Bharat Saxena,Marketing,31,Brightline,bharat.saxena@brightline.io
Charu Mishra,Marketing,29,Acme Corp,charu.mishra@acmecorp.com
Deepak Trivedi,Marketing,35,Cloudnine,deepak.trivedi@cloudnine.in
Esha Malhotra,Marketing,26,Brightline,esha.malhotra@brightline.io
Firoz Currim,Marketing,40,Acme Corp,firoz.currim@acmecorp.com
Gita Ramachandran,Marketing,33,Cloudnine,gita.ramachandran@brightline.io
Harsh Vora,Marketing,28,Acme Corp,harsh.vora@acmecorp.com
Indira Sen,Marketing,30,Brightline,indira.sen@brightline.io
Jatin Ahuja,Marketing,31,Cloudnine,jatin.ahuja@cloudnine.in
Kavya Hegde,Support,24,Acme Corp,kavya.hegde@acmecorp.com
Lalit Chandra,Support,26,Brightline,lalit.chandra@brightline.io
Mira Dutta,Support,29,Acme Corp,mira.dutta@acmecorp.com
Naveen Kamath,Support,31,Cloudnine,naveen.kamath@cloudnine.in
Ojas Wagh,Support,27,Brightline,ojas.wagh@brightline.io
Priti Naik,Support,33,Acme Corp,priti.naik@acmecorp.com
Qadir Hussain,Support,25,Cloudnine,qadir.hussain@cloudnine.in
Rohan Bhatia,Support,28,Brightline,rohan.bhatia@brightline.io
Sneha Kapadia,Support,30,Acme Corp,sneha.kapadia@acmecorp.com
Tarun Ghosh,Finance,35,Acme Corp,tarun.ghosh@acmecorp.com
Uma Subramaniam,Finance,38,Brightline,uma.subramaniam@brightline.io
Vikram Chopra,Finance,42,Acme Corp,vikram.chopra@acmecorp.com
Waheeda Sayed,Finance,31,Cloudnine,waheeda.sayed@cloudnine.in
Yash Thakur,Finance,29,Brightline,yash.thakur@brightline.io
Zara Lobo,Finance,45,Acme Corp,zara.lobo@acmecorp.com
Amit Banerjee,Finance,33,Cloudnine,amit.banerjee@cloudnine.in
Brinda Pai,Finance,39,Brightline,brinda.pai@brightline.io
Chirag Mehta,HR,29,Acme Corp,chirag.mehta@acmecorp.com
Devika Nambiar,HR,34,Brightline,devika.nambiar@brightline.io
Ehsan Qureshi,HR,31,Acme Corp,ehsan.qureshi@acmecorp.com
Falguni Dave,HR,38,Cloudnine,falguni.dave@cloudnine.in
Girish Prabhu,HR,28,Brightline,girish.prabhu@cloudnine.in
Hema Raghavan,Legal,41,Acme Corp,hema.raghavan@acmecorp.com
Imran Merchant,Legal,36,Brightline,imran.merchant@brightline.io
Jyoti Salvi,Legal,44,Acme Corp,jyoti.salvi@acmecorp.com
Kabir Oberoi,Legal,39,Cloudnine,kabir.oberoi@cloudnine.in
```

## DATA2 (for S28) — messy pipe-delimited log lines

```
2026-07-01T09:14:22|nadia|login|success
2026-07-01T09:16:05|tomas|export_report|success
2026-07-01T09:18:41|sanjay|login|failed
login|2026-07-01T09:19:03|sanjay|success
2026-07-01T09:22:17|rhea|delete_user|success
2026-07-01T09:25:50|lena|upload_asset|success
2026-07-01T09:2X:!!|???|corrupt#@|
2026-07-01T09:31:09|nadia|edit_settings|success
success|2026-07-01T09:33:44|tomas|login
2026-07-01T09:35:12|priya|export_report|failed
2026-07-01T09:38:27|rhea|login|success
2026-07-01T09:40:55|lena|logout|success
```

---

## EMAIL1 (for S31, S36, S41, S46, S52, S55) — vendor renewal email thread

```
From: priya.nair@corely.com — 3 March, 9:14 am
Subject: Northwind renewal — decision needed

Team, Northwind's contract expires 31 March. Their renewal quote is
Rs 18.4 lakh for the year, up from Rs 15.2 lakh. We need a decision by
20 March, otherwise it auto-renews at list price.

From: tomas.vrba@corely.com — 3 March, 11:02 am

That's a 21% jump. What are we getting for it? Last year we used maybe 60%
of the seats we paid for. Before we sign anything I'd like a seat audit.

From: rhea.kapoor@corely.com — 3 March, 2:30 pm

Finance can't approve an increase above 10% without board sign-off. To stay
inside my authority the number has to come in under Rs 16.7 lakh.

From: priya.nair@corely.com — 5 March, 10:45 am

Spoke to Northwind. Two options: Rs 16.2 lakh a year if we commit to two
years, or Rs 17.9 lakh for a single year. Worth flagging that the two-year
deal drops the onboarding support package we currently get.

From: sanjay.mehta@corely.com — 5 March, 4:20 pm

Northwind had a security incident in November that they never formally
disclosed to us — I only heard about it from a peer at another customer.
I would want a fresh security review before we commit to anything
multi-year.

From: nadia.iyer@corely.com — 6 March, 8:05 am

Let's take the two-year at Rs 16.2 lakh. Priya, please confirm with them by
Friday 13 March so we're comfortably inside the window. Thanks all.
```

## FIN1 (for S32, S39, S43, S48, S53, S58) — quarterly business review extract

```
Corely — Q3 FY26 business review (internal)

Revenue for the quarter was Rs 42.6 crore, against Rs 38.1 crore in Q2 — a
rise of 11.8% quarter on quarter. Year on year, revenue is up 34%.

New logos added: 27, against 31 in Q2. Average contract value rose to
Rs 19.4 lakh from Rs 16.8 lakh.

Net revenue retention was 104%, down from 112% in Q2. Gross retention was
89%, down from 94%. Churned ARR for the quarter was Rs 3.8 crore, of which
Rs 2.9 crore came from a single enterprise account (Meridian) that
consolidated onto a competitor.

Gross margin held at 71%. Sales and marketing spend was Rs 14.2 crore, or
33% of revenue, up from 29% in Q2. CAC payback lengthened to 19 months from
15 months.

Headcount ended at 412, up 38 in the quarter. Revenue per employee was
Rs 41.4 lakh annualised, essentially flat.

Cash burn was Rs 6.1 crore for the quarter; runway stands at 14 months at
the current rate.

Note: the revenue figure above includes Rs 2.2 crore of one-time migration
services billed to two customers, which will not repeat in Q4.
```

## REVIEWS1 (for S33, S38, S44, S50, S57) — customer reviews

```
1. ★★☆☆☆ "Works fine until you have more than about 500 rows, then exports
   just spin forever. Support told me it's expected behaviour."
2. ★★★★★ "The scheduling automation saved my team hours a week. Setup took
   fifteen minutes."
3. ★★★☆☆ "Good product, but the mobile app logs me out every few days and I
   have to redo two-factor each time."
4. ★★☆☆☆ "Exports over a few hundred records time out. Been reported since
   at least last year going by the forums."
5. ★★★★☆ "Does what it says. Wish the reporting let me filter by more than
   one tag at a time."
6. ★☆☆☆☆ "Billed me twice in March and it took four emails to get refunded.
   Product is okay, billing is not."
7. ★★★★★ "Best-in-class automation. We replaced two other tools with it."
8. ★★★☆☆ "Solid, but the session keeps expiring on mobile — I'm re-entering
   my 2FA code constantly."
9. ★★★★☆ "Great for small teams. Reporting filters are limited if you want
   anything cross-tag."
10. ★★☆☆☆ "Support response times went from same-day to about a week after
   they changed plans."
11. ★★★★★ "Onboarding was genuinely painless and the automations are
   reliable."
12. ★★☆☆☆ "Charged for an annual plan I'd cancelled. Refund came eventually
   but nobody explained what happened."
```

## LONGDOC1 (for S34, S40, S42, S47, S51, S54, S59) — remote work and expenses policy

```
CORELY — REMOTE WORK AND EXPENSES POLICY
Version 4.2 · Applies to all full-time employees and fixed-term contractors

1. PURPOSE AND SCOPE

This policy sets out how Corely employees work remotely, what the company
pays for, and what approvals are needed. It applies to all full-time
employees and to fixed-term contractors engaged for more than ninety days.
It does not apply to vendors, agency staff, or interns on programmes shorter
than one quarter, who are covered by separate arrangements agreed with the
People team at the point of engagement.

2. WORKING PATTERN

Corely operates on a remote-first basis. Employees may work from any
location within India without prior approval, provided they remain
contactable during core hours. Core hours are 11:00 to 16:00 IST, Monday to
Friday. Outside core hours, employees arrange their own schedule with their
reporting manager. Meetings should not be scheduled outside core hours
except where a customer's timezone makes it unavoidable, and in that case
the meeting owner is expected to offer compensatory time off.

Employees wishing to work from outside India must seek written approval at
least three weeks in advance, because tax residency and data residency
obligations differ by jurisdiction. Approval for work outside India is
limited to a maximum of sixty days in any rolling twelve-month period.

3. OFFICE ATTENDANCE

Corely maintains offices in Bengaluru and Pune. Attendance is not mandatory.
Teams may agree their own in-person cadence. Where a team agrees a regular
in-person day, the company reimburses travel to the office for that day at
actual cost for public transport, or at eight rupees per kilometre for
personal vehicles. Daily travel reimbursement does not apply to employees
whose registered home address is more than one hundred kilometres from the
office; those employees claim under the travel section instead.

4. HOME OFFICE EQUIPMENT

Every employee is entitled to a home office stipend of thirty-five thousand
rupees, available once every three years from their joining date. The
stipend may be spent on a desk, chair, monitor, keyboard, mouse, lighting,
or noise-cancelling headphones. It may not be spent on general household
furniture, mobile phones, tablets, or internet connections, which are
covered separately in section six.

Equipment purchased with the stipend belongs to the employee, not to the
company, and does not need to be returned on exit. Laptops are issued
separately by IT, remain company property, and must be returned within seven
days of the last working day.

5. EXPENSE APPROVAL THRESHOLDS

Expenses are submitted through the finance portal within thirty days of
being incurred. Claims submitted after thirty days require a written
explanation and are approved at the discretion of the finance team.

Any single expense above five thousand rupees requires pre-approval from the
employee's reporting manager before it is incurred. Pre-approval is
requested in the finance portal and is normally answered within two working
days. Expenses incurred without required pre-approval may be refused, and
repeated instances are treated as a performance matter rather than a
finance matter.

Expenses above fifty thousand rupees additionally require approval from a
department head, regardless of budget availability.

6. CONNECTIVITY AND SUBSCRIPTIONS

The company contributes one thousand five hundred rupees per month towards
home internet, paid with salary and requiring no claim. Employees who need
a higher-speed connection for their role — primarily those in engineering
and support — may claim the actual cost up to three thousand rupees per
month, with manager approval renewed annually.

Software subscriptions needed for work are requested through IT rather than
claimed as expenses. Subscriptions bought personally and claimed back may be
refused, because the company cannot manage security or offboarding on
accounts it does not control.

7. CO-WORKING SPACES

Employees who prefer not to work from home may use a co-working space.
Reimbursement is capped at eight thousand rupees per month and requires the
reporting manager's approval once, at the start of the arrangement, rather
than monthly. The company does not reimburse day passes bought ad hoc
without an approved arrangement in place, and does not reimburse co-working
memberships for employees who also claim the daily office travel allowance
described in section three.

8. TRAVEL

Domestic travel is booked through the company travel desk. Economy class is
the standard for flights under four hours. Hotel spend is capped at six
thousand rupees per night in metro cities and four thousand rupees
elsewhere. A daily allowance of one thousand two hundred rupees covers meals
and incidentals and does not require receipts.

International travel requires approval from a department head and, where
the trip exceeds five working days, from the CEO. Business class is
permitted only for flights longer than eight hours.

9. EQUIPMENT LOSS AND DAMAGE

Loss or damage of company equipment must be reported to IT within
twenty-four hours. The company bears the cost of accidental damage. In cases
of negligence — equipment left unattended in a public place, for example —
the company may recover up to twenty-five per cent of the replacement cost
from the employee, subject to a written finding by the People team.

10. EXCEPTIONS AND REVIEW

Any exception to this policy requires written approval from both the
employee's reporting manager and the People team; approval from one alone is
not sufficient. Exceptions are recorded and reviewed quarterly.

This policy is reviewed every eighteen months. The next scheduled review is
due on 12 January 2027. Questions about interpretation should be directed to
people@corely.com rather than to the finance team, whose remit is limited to
processing claims under the rules as written.
```

---

# GROUND TRUTH — graders only, never sent to Merlin

**CODE2 bug**: loop runs `len-n` to `len-2`, skipping the final element (off-by-one). Triggered by any n ≥ 1; e.g. `last_n_average([1,2,3], 2)` returns 1.0 instead of 2.5.

**TEXT1**: delay reasons = (1) Corely v2 deprecation / vendor API migration slip, (2) open security review. Budget concern raised by **the platform team (Tomas)**. CFO contradiction = headcount freeze "no exceptions" vs her earlier approval of two contractors. Action items: Tomas 18 Oct, Sanjay 20 Oct, Lena 24 Oct, Nadia 16 Oct. Security review completed **12 October** per TEXT1.

**TEXT2**: 5 commitments — v2 migration by 30 Nov; audit starts 5 Nov, published 15 Dec; 99.95% SLA from 1 Jan; monthly delivery report, first 8 Dec; VP Reliability by 31 Jan. Dates mentioned (7): 8 Oct, 30 Nov, 5 Nov, 15 Dec, 1 Jan, 8 Dec, 31 Jan (plus 21 Oct dateline and 15 Oct — accept 8–9 if statement date/15 Oct included; grade on the 7 core + consistency). Word counts: **"delivery" = 4, "deliveries" = 1** ("dependable delivery", "delivery report", "first delivery", "The delivery of these commitments"; "missed deliveries"). **Seeded conflict for S27**: security review completion — TEXT1 says 12 Oct, TEXT2 says 15 Oct.

**TEXT3**: 8 emails — nadia.iyer@, tomas.vrba@, sanjay.mehta@, lena.f@, rhea.kapoor@, priya.nair@, press@corely.com, help@corely-support.com. Missing fields (if used in a golden item): Tomas (no phone), Lena (no phone, role Design), press (no name/role/phone).

**DATA1**: 62 rows. Engineering = 14 people (S09: the 14 rows; note Gaurav Menon's email domain is anomalous but he IS engineering). Distinct companies = 3; most people = **Acme Corp (26)**; Brightline 20, Cloudnine 16 (S18). Sales average age = **32.0** (12 people, sum 384). Department stats for S29: Engineering 14 / avg 31.4; Sales 12 / 32.0; Marketing 10 / 31.0; Support 9 / 28.1; Finance 8 / 36.5; HR 5 / 32.0; Legal 4 / 40.0. **Seeded email-domain mismatches (reserve — good golden-item material), exactly 4**: Gaurav Menon (Acme Corp, @brightline.io), Ritika Singh (Cloudnine, @acmecorp.com), Gita Ramachandran (Cloudnine, @brightline.io), Girish Prabhu (Brightline, @cloudnine.in).

**DATA2**: swapped rows = line 4 (sanjay: fields rotated, should be `2026-07-01T09:19:03|sanjay|login|success`) and line 9 (tomas: `2026-07-01T09:33:44|tomas|login|success`). Corrupted row to drop = line 7. Clean output = 11 rows + header.

**EMAIL1**: Decision maker = **Nadia Iyer**; decision = two-year Northwind deal at **Rs 16.2 lakh/year**. Numbers: old Rs 15.2L, quoted Rs 18.4L (21% rise), finance ceiling Rs 16.7L, options Rs 16.2L (2-yr) / Rs 17.9L (1-yr). **Three planted traps**: (1) Sanjay's undisclosed-security-incident objection is never addressed — the multi-year commitment he warned against is exactly what gets chosen; (2) the deadline **shifts from 20 March to 13 March**; (3) the two-year option **drops onboarding support**, a cost the final decision never acknowledges. Tomas's requested seat audit is also never answered (60% seat utilisation).

**FIN1**: Revenue Rs 42.6cr (+11.8% QoQ from Rs 38.1cr, +34% YoY) — **but includes Rs 2.2cr one-time migration services that won't repeat**, so underlying growth is ~6.0% QoQ (40.4 vs 38.1). Improving: revenue, ACV (Rs 16.8L→19.4L), gross margin flat 71%. **Declining**: new logos 31→27, NRR 112%→104%, GRR 94%→89%, S&M 29%→33% of revenue, CAC payback 15→19 months. Churn Rs 3.8cr, Rs 2.9cr of it one account (Meridian). Headcount 412 (+38); revenue/employee Rs 41.4L flat. Burn Rs 6.1cr, runway 14 months. Most misleading number = the headline revenue/growth rate (one-time services + a single-account churn distortion).

**REVIEWS1**: 12 reviews, avg **3.08 stars** (5+5+5=three 5★, two 4★, three 3★... exact: 2,5,3,2,4,1,5,3,4,2,5,2 = 38/12 = 3.17). Three complaint clusters: **(a) export timeouts on large datasets** (#1, #4), **(b) mobile session expiry / repeated 2FA** (#3, #8), **(c) billing errors and slow refunds** (#6, #12), plus support-speed decline (#10) and **limited cross-tag reporting filters** (#5, #9). S57 answer: #1 and #4 are the same underlying export issue; #3 and #8 the same session issue; #5 and #9 the same filter limitation; #6 and #12 the same billing-refund issue. Praise cluster: automation/scheduling reliability (#2, #7, #11).

**LONGDOC1** — five planted canaries, distributed front to back (a summary missing the last one indicates truncation): (A) core hours **11:00–16:00 IST**; (B) home office stipend **Rs 35,000 once every three years**; (C) single expense above **Rs 5,000 needs manager pre-approval** (and above Rs 50,000 needs department head); (D) co-working capped at **Rs 8,000/month**; (E) **final paragraph**: policy reviewed **every 18 months, next review due 12 January 2027**, and exceptions need **written approval from BOTH reporting manager and People team**. Other checkables: outside-India work = 3 weeks notice, max 60 days per rolling 12 months; office travel Rs 8/km, not available beyond 100 km; internet Rs 1,500/month default, up to Rs 3,000 with approval; hotel Rs 6,000 metro / Rs 4,000 elsewhere; per diem Rs 1,200; business class only over 8 hours; negligence recovery up to 25% of replacement cost; claims window 30 days. **Gaps for S59** (genuinely not covered): no mention of internet/equipment for employees working outside India, no accessibility/medical-equipment provision, no stipend pro-rating for leavers, nothing on co-working security requirements, no interns/vendors coverage (explicitly out of scope).
