# WRAPPER TEST — 5 summarization prompts, two arms

## What this tests

Your first wrapper result (Merlin's Haiku vs the same model raw) came from short
factual answers: Merlin lost 5 of 6, all by small margins. These 5 test the same
question on SUMMARIZATION, where Merlin's harness has far more room to hurt —
long inputs, long outputs, strict formats.

## How to run each one

1. **Arm A — Merlin**: fresh chat, model = Merlin Magic. Paste the prompt.
   Record the MODEL BADGE it shows. First response only, no regenerate.
2. **Arm B — the same model, directly**: open that same model in its own app
   (Gemini 3.1 Pro -> gemini.google.com / AI Studio; Claude Haiku 4.5 -> claude.ai;
   GPT -> chatgpt.com) and paste the IDENTICAL prompt. Fresh chat there too.

Same day, same text, no edits between arms. If Merlin truncates your paste or
errors on length, SAY SO — that is itself the finding.

## Report format

    === S42 | ARM A (Merlin) | badge: Gemini 3.1 Pro | cost: 15 ===
    <full response>

    === S42 | ARM B (Gemini 3.1 Pro direct) ===
    <full response>

---

## 1. S42 — INPUT TRUNCATION

*Why this one:* Does the model still see the END of a long document? The answer lives in the final paragraph. If Merlin's version can't quote it but the raw model can, Merlin truncated the input.

*Difficulty tier:* medium

```
What does the FINAL section of this policy say? Quote the review date and the exceptions rule exactly. 

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


```

## 2. S51 — OUTPUT COMPLETENESS

*Why this one:* ~15 numeric rules spread across a long document. Count how many each side returns. A short list = output cap or aggressive compression.

*Difficulty tier:* hard

```
List every rule in this policy that mentions a specific number, with the number and what it governs. Miss nothing. 

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


```

## 3. S39 — FORMAT + NUMERIC FIDELITY

*Why this one:* ~20 figures, table requested, no commentary allowed. Tests whether Merlin's own system prompt overrides your format instruction.

*Difficulty tier:* easy

```
List every number in this quarterly review as a two-column table: metric and value. Do not add commentary. 

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


```

## 4. S17 — LONG-OUTPUT VOLUME

*Why this one:* 62 names, sorted. This is the exact failure a Merlin user reported publicly. Count what comes back on each side.

*Difficulty tier:* medium

```
Extract all 62 names from 

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

 as a numbered list, sorted alphabetically by last name.
```

## 5. S52 — REASONING DEPTH

*Why this one:* Two things are buried in the thread: a deadline that changes, and an objection nobody answers. Tests whether Merlin's version reasons as hard as the raw model.

*Difficulty tier:* hard

```
Read this email thread carefully. Identify (a) any deadline that changed during the thread, and (b) any objection or request that was never answered before the decision was made. Quote the relevant lines. 

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


```
