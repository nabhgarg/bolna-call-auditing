# MERLIN RUN SHEET — BATCH 2 · 30 new summarization prompts (S31–S60)

Rules: fresh chat per prompt · model = Merlin Magic · first response only, no regenerate.
After EACH response record: MODEL BADGE shown, credit/query cost if visible, whether it visibly fetched/searched.

Report format per prompt:

    === S31 | badge: Gemini 3.1 Pro | cost: 15 | search: no ===
    <full response verbatim>

NOTE: S34/S38/S42/S47/S51/S54/S57 use a long policy document. Paste the WHOLE block —
if Merlin truncates your paste, say so in your report, because that is itself a finding.

---

## 01. S31  (easy)

```
Read this email thread and tell me in two sentences: who made the final decision, and what was decided? 

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

## 02. S32  (easy)

```
From this quarterly review, what was revenue this quarter and how did it change versus last quarter? 

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

## 03. S33  (easy)

```
Summarize the overall sentiment of these customer reviews in one sentence, and estimate the average star rating. 

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


```

## 04. S34  (easy)

```
Summarize this policy document in 5 bullet points. 

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

## 05. S35  (easy)

```
Summarize this page in 6 bullet points: https://en.wikipedia.org/wiki/Attention_Is_All_You_Need
```

## 06. S36  (easy)

```
List every person in this email thread with their role and their position on the renewal, one line each. 

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

## 07. S37  (easy)

```
Summarize the three most common complaints in these reviews, most frequent first. 

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


```

## 08. S38  (easy)

```
What are the core working hours in this policy, and what is the home office stipend? 

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

## 09. S39  (easy)

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

## 10. S40  (easy)

```
Summarize this Wikipedia article in exactly 4 sentences: https://en.wikipedia.org/wiki/Retrieval-augmented_generation
```

## 11. S41  (medium)

```
Read this email thread and answer three things: what was decided, what it costs, and which raised concern was never addressed before the decision. 

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

## 12. S42  (medium)

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

## 13. S43  (medium)

```
From this quarterly review, produce two lists: metrics that improved and metrics that declined. Put each metric in exactly one list. 

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

## 14. S44  (medium)

```
Write an 80-word summary of these reviews for the product team. Only state patterns actually supported by the reviews — do not invent a consensus. 

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


```

## 15. S45  (medium)

```
Summarize this article including what its 'Criticism' or 'Limitations' section says: https://en.wikipedia.org/wiki/Large_language_model
```

## 16. S46  (medium)

```
Based on this email thread, draft the confirmation email Priya should send to Northwind. Include the commercial terms agreed and any condition the team raised. 

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

## 17. S47  (medium)

```
Extract every monetary limit or cap in this policy as a table: what it covers and the amount. 

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

## 18. S48  (medium)

```
Using both documents: is the Northwind renewal decision consistent with the financial picture? Answer in 100 words. 

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

## 19. S49  (medium)

```
Summarize this video into sections with timestamps, then state the single main argument in one sentence: https://www.youtube.com/watch?v=zjkBMFhNj_g
```

## 20. S50  (medium)

```
Convert these reviews into strict JSON: an array of objects with keys stars (int), theme (string), and sentiment (positive/negative/mixed). Return only JSON. 

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


```

## 21. S51  (hard)

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

## 22. S52  (hard)

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

## 23. S53  (hard)

```
Which single number in this quarterly review is most likely to mislead someone reading only the headline, and why? 

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

## 24. S54  (hard)

```
Summarize this policy in 200 words or fewer, such that an employee reading only your summary could follow it without breaking a rule. 

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

## 25. S55  (hard)

```
Using the policy and the email thread together: was the renewal decision process compliant with the approval rules described in the policy? Explain precisely. 

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

## 26. S56  (hard)

```
Summarize these reviews, then group the complaints: which separate reviews are actually reporting the same underlying issue? 

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


```

## 27. S57  (hard)

```
What does this policy NOT cover? List three genuine gaps a reader would have to ask about, and do not invent rules that are not there. 

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

## 28. S58  (hard)

```
Write the investor-facing paragraph (120 words) for this quarter. It must be accurate about the declines and must not present the revenue figure misleadingly. 

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

## 29. S59  (hard)

```
Summarize this article in 250 words, then list any claim in your own summary that the source does not directly support: https://en.wikipedia.org/wiki/Model_collapse
```

## 30. S60  (hard)

```
From this email thread, write the one-paragraph decision record a manager would file: what was decided, by whom, on what basis, what it cost, and what risk was accepted. 

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
