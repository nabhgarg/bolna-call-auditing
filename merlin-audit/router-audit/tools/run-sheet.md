# MERLIN RUN SHEET — 60 prompts, shuffled order

Rules: fresh chat per prompt · model = Merlin Magic · first response only, no regenerate.
After EACH response record: MODEL BADGE shown, credit/query cost if visible, search/tools visibly used (yes/no).
Prompts marked [GROUND TRUTH TODAY]: immediately look up the real answer yourself and note it + source URL.
Report format per prompt (paste back to Claude):

    === F21 | badge: GPT-4.1 mini | cost: 1 | search: no | gt: iPhone 17, Rs 82900 (apple.com/in) ===
    <full response verbatim>

---

## 01. F13

```
What actually happens medically when you crack your knuckles, and is the arthritis claim true? What kind of evidence exists?
```

## 02. S16 [URL — note if Merlin visibly fetched the page/video]

```
What does https://en.wikipedia.org/wiki/Goodhart%27s_law say, and give two business examples NOT mentioned in the article.
```

## 03. F11

```
List the 5 largest countries by population in order with rough figures. State the year of your figures.
```

## 04. S11

```
Summarize 

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

 as meeting minutes: attendees, decisions, action items with owners, open questions. Use those four headings exactly.
```

## 05. S21

```
Summarize 

> **Statement from Corely, Inc. — 21 October**
>
> Following the service disruption of 8 October, we are publishing our remediation commitments. We know that dependable delivery is why customers choose Corely, and two missed deliveries in one quarter fall short of that standard.
>
> First, we will complete the migration of all customers off the v2 endpoints by 30 November. Second, an independent audit of our deprecation process will begin on 5 November and its findings will be published in full by 15 December. Third, we are committing to a 99.95% uptime SLA, effective 1 January, with service credits applied automatically rather than by request. Fourth, all enterprise customers will receive a dedicated delivery report each month, with the first delivery scheduled for 8 December. Fifth, we will hire a VP of Reliability, with the search concluding by 31 January.
>
> We also want to correct the record on our internal security review, which some customers have asked about: that review was substantially complete on 15 October, and no customer data was affected at any point.
>
> We recognize that a statement is not a fix. The delivery of these commitments — not this document — is what we should be judged on.

 three times for three audiences — an affected customer, an investor, and the internal engineering team — 60 words max each, labeled. Each version must emphasize what THAT audience cares about, not the same summary three times.
```

## 06. S24

```
From 

> **Statement from Corely, Inc. — 21 October**
>
> Following the service disruption of 8 October, we are publishing our remediation commitments. We know that dependable delivery is why customers choose Corely, and two missed deliveries in one quarter fall short of that standard.
>
> First, we will complete the migration of all customers off the v2 endpoints by 30 November. Second, an independent audit of our deprecation process will begin on 5 November and its findings will be published in full by 15 December. Third, we are committing to a 99.95% uptime SLA, effective 1 January, with service credits applied automatically rather than by request. Fourth, all enterprise customers will receive a dedicated delivery report each month, with the first delivery scheduled for 8 December. Fifth, we will hire a VP of Reliability, with the search concluding by 31 January.
>
> We also want to correct the record on our internal security review, which some customers have asked about: that review was substantially complete on 15 October, and no customer data was affected at any point.
>
> We recognize that a statement is not a fix. The delivery of these commitments — not this document — is what we should be judged on.

: draft the 5 hardest questions a journalist should ask this company, each targeting a specific weakness or omission in the statement.
```

## 07. S01 [URL — note if Merlin visibly fetched the page/video]

```
Summarize this page in 5 bullet points: https://www.paulgraham.com/ds.html
```

## 08. F17 [GROUND TRUTH TODAY]

```
What are the three tallest completed buildings in the world right now, with heights and completion years?
```

## 09. F01

```
What is the capital of Australia, and what's the most common wrong answer people give? Why the confusion?
```

## 10. F20 [GROUND TRUTH TODAY]

```
Who is the current Pope, and when did their papacy begin?
```

## 11. F25 [GROUND TRUTH TODAY]

```
Who won the most recent completed cricket match between India and Australia (any format), when was it, and what was the margin?
```

## 12. F12

```
Compare Apple's M3 and M4 chips: process node, CPU/GPU cores in the base version, and one headline improvement. Table format.
```

## 13. F09

```
What does GDP stand for, and explain in two sentences what it measures and one thing it famously fails to capture.
```

## 14. F30 [GROUND TRUTH TODAY]

```
I'm deciding between the two most recent flagship phones from Samsung and Google. Which models are those right now, and give me a 5-row comparison table with current India prices.
```

## 15. S30 [URL — note if Merlin visibly fetched the page/video]

```
Summarize this YouTube video, then separately list every specific number or statistic the speaker states, with its approximate timestamp: https://www.youtube.com/watch?v=zjkBMFhNj_g
```

## 16. S22

```
Read 

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

. The CFO's position is partly contradicted by something said earlier in the meeting. Identify the contradiction precisely, quoting both statements.
```

## 17. F22

```
Who is the current CEO of OpenAI, and has that changed in the last 12 months? Cite a source.
```

## 18. S10

```
Extract every date mentioned in 

> **Statement from Corely, Inc. — 21 October**
>
> Following the service disruption of 8 October, we are publishing our remediation commitments. We know that dependable delivery is why customers choose Corely, and two missed deliveries in one quarter fall short of that standard.
>
> First, we will complete the migration of all customers off the v2 endpoints by 30 November. Second, an independent audit of our deprecation process will begin on 5 November and its findings will be published in full by 15 December. Third, we are committing to a 99.95% uptime SLA, effective 1 January, with service credits applied automatically rather than by request. Fourth, all enterprise customers will receive a dedicated delivery report each month, with the first delivery scheduled for 8 December. Fifth, we will hire a VP of Reliability, with the search concluding by 31 January.
>
> We also want to correct the record on our internal security review, which some customers have asked about: that review was substantially complete on 15 October, and no customer data was affected at any point.
>
> We recognize that a statement is not a fix. The delivery of these commitments — not this document — is what we should be judged on.

 and what happens on it, as a markdown table sorted chronologically.
```

## 19. F23

```
What was the closing value of the NIFTY 50 yesterday? Name the date you're using.
```

## 20. S18

```
Using 

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

: how many distinct companies are listed, which company has the most people, and what is the average age of the Sales department (1 decimal)?
```

## 21. F19

```
Is the Great Wall of China visible from space with the naked eye? And give one more widely-believed 'fact' that is false, with its origin.
```

## 22. S02 [URL — note if Merlin visibly fetched the page/video]

```
Give me a 2-sentence TL;DR of https://en.wikipedia.org/wiki/CRISPR_gene_editing suitable for a 12-year-old.
```

## 23. F29 [GROUND TRUTH TODAY]

```
What major rocket launches (NASA, SpaceX, or ISRO) are scheduled in the next 30 days? Give dates and missions, and say how confident you are.
```

## 24. S13 [URL — note if Merlin visibly fetched the page/video]

```
From https://en.wikipedia.org/wiki/Transformer_(deep_learning) explain self-attention to a product manager in under 120 words using one concrete analogy.
```

## 25. S17

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

## 26. S29

```
From 

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

: produce a two-level summary — first a table of headcount and average age per department, then one insight per department that is actually supported by the data (no generic filler). Any unsupported claim = failure.
```

## 27. S27

```
Using 

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

 and 

> **Statement from Corely, Inc. — 21 October**
>
> Following the service disruption of 8 October, we are publishing our remediation commitments. We know that dependable delivery is why customers choose Corely, and two missed deliveries in one quarter fall short of that standard.
>
> First, we will complete the migration of all customers off the v2 endpoints by 30 November. Second, an independent audit of our deprecation process will begin on 5 November and its findings will be published in full by 15 December. Third, we are committing to a 99.95% uptime SLA, effective 1 January, with service credits applied automatically rather than by request. Fourth, all enterprise customers will receive a dedicated delivery report each month, with the first delivery scheduled for 8 December. Fifth, we will hire a VP of Reliability, with the search concluding by 31 January.
>
> We also want to correct the record on our internal security review, which some customers have asked about: that review was substantially complete on 15 October, and no customer data was affected at any point.
>
> We recognize that a statement is not a fix. The delivery of these commitments — not this document — is what we should be judged on.

 from assets.md together: build a single timeline table of all events across both documents, with a Source column saying which document each came from. Flag the one event whose dates conflict between the documents.
```

## 28. S20

```
Turn 

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

 into an executive escalation email to the CEO: 120 words max, leads with the decision needed, no jargon from the transcript.
```

## 29. F18

```
Who most recently won the Nobel Prize in Literature, and for what? If your information might be out of date, say so explicitly and tell me how to check.
```

## 30. F02

```
Who wrote 'One Hundred Years of Solitude' and in what year was it first published?
```

## 31. S09

```
From the CSV below, list ONLY the people in the Engineering department, as 'Name <email>', one per line, nothing else: 

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


```

## 32. S04 [URL — note if Merlin visibly fetched the page/video]

```
What are the main arguments in https://en.wikipedia.org/wiki/Universal_basic_income both for and against? Give 3 of each.
```

## 33. S28

```
Convert 

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

 (messy pipe-delimited log lines) into clean CSV with headers timestamp,user,action,status — fixing the two rows with swapped fields and dropping the one corrupted row. State which rows you fixed/dropped.
```

## 34. S07

```
Read 

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

 and answer: what were the two stated reasons for the project delay, and which team raised the budget concern?
```

## 35. F15

```
Was Napoleon actually short? Give the measurement in both French and English units of the era and explain where the myth comes from.
```

## 36. F08

```
What is the largest planet in our solar system, and roughly how many Earths would fit inside it by volume?
```

## 37. S19 [URL — note if Merlin visibly fetched the page/video]

```
Give me the 5 most actionable takeaways from https://www.youtube.com/watch?v=HiTwDLKmeZc, each as one imperative sentence.
```

## 38. S14 [URL — note if Merlin visibly fetched the page/video]

```
Summarize https://www.youtube.com/watch?v=zjkBMFhNj_g (Karpathy: Intro to Large Language Models) into a one-page brief with sections: What LLMs are, How they're trained, Security risks mentioned.
```

## 39. S06 [URL — note if Merlin visibly fetched the page/video]

```
What is this page about and who is its intended audience: https://en.wikipedia.org/wiki/Kelly_criterion — answer in 3 sentences.
```

## 40. S15

```
Read 

> **Statement from Corely, Inc. — 21 October**
>
> Following the service disruption of 8 October, we are publishing our remediation commitments. We know that dependable delivery is why customers choose Corely, and two missed deliveries in one quarter fall short of that standard.
>
> First, we will complete the migration of all customers off the v2 endpoints by 30 November. Second, an independent audit of our deprecation process will begin on 5 November and its findings will be published in full by 15 December. Third, we are committing to a 99.95% uptime SLA, effective 1 January, with service credits applied automatically rather than by request. Fourth, all enterprise customers will receive a dedicated delivery report each month, with the first delivery scheduled for 8 December. Fifth, we will hire a VP of Reliability, with the search concluding by 31 January.
>
> We also want to correct the record on our internal security review, which some customers have asked about: that review was substantially complete on 15 October, and no customer data was affected at any point.
>
> We recognize that a statement is not a fix. The delivery of these commitments — not this document — is what we should be judged on.

 and extract every commitment the company made, with its deadline, as a two-column table.
```

## 41. F16

```
A friend says 'lightning never strikes the same place twice' and cites the Empire State Building. Correct them with the actual number of times it's struck per year and the physics of why.
```

## 42. S25 [URL — note if Merlin visibly fetched the page/video]

```
Read https://www.paulgraham.com/founders.html and https://www.paulgraham.com/determination.html. Which single trait does Graham weight most across both essays? Defend your answer with one quote from each essay (under 15 words per quote).
```

## 43. F27

```
What is the current USD to INR exchange rate, roughly how has it moved over the past 6 months, and what's one driver analysts cite? Name your source and its date.
```

## 44. F28 [GROUND TRUTH TODAY]

```
What is India's most recently published unemployment rate, for what period, and from which body (CMIE or PLFS — specify which you're citing)?
```

## 45. F06

```
What is the boiling point of water at sea level in both Celsius and Fahrenheit, and why does it change at high altitude?
```

## 46. F03

```
What is the difference between a virus and a bacterium? Give three key differences.
```

## 47. F14

```
Explain the difference between nominal GDP and PPP-adjusted GDP, and why India's global rank differs sharply between them.
```

## 48. S03 [URL — note if Merlin visibly fetched the page/video]

```
Summarize the key advice in https://www.paulgraham.com/greatwork.html in exactly 100 words or fewer.
```

## 49. S26 [URL — note if Merlin visibly fetched the page/video]

```
Summarize https://en.wikipedia.org/wiki/Dunning%E2%80%93Kruger_effect including the section on criticisms and alternative statistical explanations. Anyone reading only your summary should know the effect is contested.
```

## 50. S08

```
Count how many times the word 'delivery' appears in this text (case-insensitive; count 'deliveries' separately and report both): 

> **Statement from Corely, Inc. — 21 October**
>
> Following the service disruption of 8 October, we are publishing our remediation commitments. We know that dependable delivery is why customers choose Corely, and two missed deliveries in one quarter fall short of that standard.
>
> First, we will complete the migration of all customers off the v2 endpoints by 30 November. Second, an independent audit of our deprecation process will begin on 5 November and its findings will be published in full by 15 December. Third, we are committing to a 99.95% uptime SLA, effective 1 January, with service credits applied automatically rather than by request. Fourth, all enterprise customers will receive a dedicated delivery report each month, with the first delivery scheduled for 8 December. Fifth, we will hire a VP of Reliability, with the search concluding by 31 January.
>
> We also want to correct the record on our internal security review, which some customers have asked about: that review was substantially complete on 15 October, and no customer data was affected at any point.
>
> We recognize that a statement is not a fix. The delivery of these commitments — not this document — is what we should be judged on.


```

## 51. F24 [GROUND TRUTH TODAY]

```
What are the three biggest AI model releases of the past month? One line each on why they matter.
```

## 52. F07

```
Who painted 'The Starry Night', when, and where is it displayed today?
```

## 53. S05 [URL — note if Merlin visibly fetched the page/video]

```
Summarize this YouTube video with timestamps for each major section: https://www.youtube.com/watch?v=UF8uR6Z6KLc (Steve Jobs' 2005 Stanford Commencement Address)
```

## 54. S23 [URL — note if Merlin visibly fetched the page/video]

```
Summarize https://en.wikipedia.org/wiki/Replication_crisis in 200 words, then list 3 claims in the article that a careful reader should want a citation for, and say why.
```

## 55. F05

```
What does HTTP status code 418 mean and where does it come from?
```

## 56. F04

```
How many time zones does India have and why did it choose that? One paragraph.
```

## 57. S12 [URL — note if Merlin visibly fetched the page/video]

```
Compare the positions in https://www.paulgraham.com/wealth.html and https://en.wikipedia.org/wiki/Economic_inequality — where would they agree and disagree? 150 words max.
```

## 58. F26 [GROUND TRUTH TODAY]

```
What is Merlin AI by Foyer, and what did they launch most recently? Two paragraphs.
```

## 59. F10

```
When did India gain independence, and what major event accompanied it? Two sentences.
```

## 60. F21 [GROUND TRUTH TODAY]

```
What is the most recent iPhone model available right now, and what is its starting price in India?
```
