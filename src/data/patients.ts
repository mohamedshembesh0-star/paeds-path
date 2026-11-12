export type HxItem = { g: string; q: string; a: string; key?: boolean; why?: string };
export type ExItem = { g: string; step: string; how: string; finding: string; key?: boolean; abnormal?: boolean };
export type Patient = {
  id: string;
  name: string;
  age: string;
  kind: string;
  who: string; // who answers
  intro: string;
  opening: string;
  history: HxItem[];
  exam: ExItem[];
  options: string[];
  answer: number;
  whyDx: string[];
  notThis: { dx: string; why: string }[];
  tests: string;
  manage: string;
  present: string;
};

export const PATIENTS: Patient[] = [
  {
    id: "neonate",
    name: "Baby Lili",
    age: "3 days old",
    kind: "Newborn",
    who: "Mother",
    intro: "Postnatal ward. Lili was born 3 days ago. The midwife asks you to see her because she looks yellow. Her mother is at the cot side.",
    opening: "Hello doctor. The midwife said she looks a bit yellow today. Is something wrong?",
    history: [
      { g: "Presenting complaint", q: "When did you first notice she looked yellow?", a: "This morning, so on day 3. Yesterday the midwife said her colour was fine.", key: true, why: "Onset after 24 hours is the single most important fact: jaundice in the first 24 h is always pathological." },
      { g: "Presenting complaint", q: "Where is the yellow colour: face only, or chest and tummy too?", a: "Her face and chest. Her legs and feet look normal to me.", why: "Jaundice spreads head to toe; below the knees or on palms and soles suggests a high level." },
      { g: "Presenting complaint", q: "Is she alert and waking for feeds, or sleepy and hard to wake?", a: "She wakes up herself every 2 to 3 hours and cries for feeds.", key: true, why: "Lethargy, poor feeding or a high-pitched cry are red flags for sepsis or bilirubin encephalopathy." },
      { g: "Feeding and output", q: "How are you feeding her, and how often?", a: "Breastfeeding only, about 8 to 10 times a day. She latches well now; the first day was difficult.", key: true, why: "Poor intake causes breastfeeding (starvation) jaundice and dehydration." },
      { g: "Feeding and output", q: "How many wet nappies in the last 24 hours?", a: "About four or five.", key: true, why: "Urine output is the best bedside sign of adequate intake." },
      { g: "Feeding and output", q: "What colour are her stools and urine?", a: "Stools were black at first and are turning greenish-yellow. Urine is pale, it doesn't stain the nappy.", key: true, why: "Pale (acholic) stools and dark urine mean conjugated jaundice: think biliary atresia." },
      { g: "Feeding and output", q: "Did she pass meconium in the first 24 hours?", a: "Yes, a few hours after birth.", why: "Delayed meconium (> 48 h) suggests Hirschsprung disease or cystic fibrosis." },
      { g: "Feeding and output", q: "Any vomiting? What colour?", a: "Just small milky possets after feeds. Nothing green.", why: "Bilious (green) vomiting in a newborn is a surgical emergency until proven otherwise." },
      { g: "Pregnancy", q: "Any problems in the pregnancy: diabetes, blood pressure, infections?", a: "No, everything was normal. Scans were all fine.", key: true },
      { g: "Pregnancy", q: "What is your blood group? Did you need anti-D?", a: "I'm A positive. They said I didn't need anti-D.", key: true, why: "Mother O or Rh-negative raises the risk of haemolytic disease (ABO or Rh incompatibility)." },
      { g: "Pregnancy", q: "Was the group B strep swab positive? Any fever in labour?", a: "The swab was negative and I had no fever.", key: true, why: "GBS, maternal fever and prolonged rupture of membranes are the risk factors for early-onset sepsis." },
      { g: "Pregnancy", q: "Any medicines, alcohol, smoking or drugs in pregnancy?", a: "Only folic acid and vitamins. I don't smoke or drink." },
      { g: "Birth", q: "How many weeks was she born at, and how?", a: "39 weeks and 4 days, a normal vaginal delivery.", key: true, why: "Prematurity makes jaundice commoner and treatment thresholds lower." },
      { g: "Birth", q: "How long were your waters broken before she was born?", a: "About six hours.", why: "More than 18 hours is a sepsis risk factor." },
      { g: "Birth", q: "Did she cry straight away? Did she need any help breathing?", a: "She cried immediately. They told me her Apgar scores were 9 and 10.", key: true },
      { g: "Birth", q: "Was a vacuum or forceps used? Any bruising or swelling on her head?", a: "No instruments. No swelling that I've seen.", why: "A cephalohaematoma or bruising adds to the bilirubin load." },
      { g: "Birth", q: "What was her birth weight?", a: "3,350 grams.", key: true },
      { g: "Since birth", q: "Did she get vitamin K?", a: "Yes, an injection straight after birth.", key: true, why: "Prevents haemorrhagic disease of the newborn." },
      { g: "Since birth", q: "Has she had the newborn screening (heel prick) and hearing test?", a: "The heel prick was done this morning. The hearing test is tomorrow." },
      { g: "Since birth", q: "Has she had a fever, or felt cold or floppy?", a: "No. Her temperature has been normal each time they checked.", key: true },
      { g: "Family", q: "Did any of your other children need treatment for jaundice?", a: "My son was a little yellow but didn't need the lights.", key: true, why: "A sibling who needed phototherapy increases the risk." },
      { g: "Family", q: "Any blood disorders in the family, like G6PD deficiency or spherocytosis? Are you and her father related?", a: "No blood problems that we know of, and we're not related.", why: "Inherited haemolytic anaemias cause early or severe jaundice." },
      { g: "Social", q: "Who is at home, and how are you coping?", a: "My husband and our 3-year-old son. I'm tired but fine, and my mother is helping." },
    ],
    exam: [
      { g: "Before you touch", step: "Wash hands, ask permission, warm room, undress to the nappy", how: "Examine in good daylight on a warm surface with the mother present. Keep the baby calm: listen to the heart first if she is quiet.", finding: "Mother agrees. Baby is pink-yellow, calm, in a flexed posture.", key: true },
      { g: "Before you touch", step: "Measurements: weight, length, head circumference", how: "Weigh naked. Plot all three on the centile chart. Up to 10% weight loss in the first days is acceptable.", finding: "Weight 3,150 g (6% below birth weight). Length 50 cm. Head circumference 34.5 cm. All about the 50th centile.", key: true },
      { g: "Before you touch", step: "Vital signs", how: "Count for a full minute. Normal newborn: HR 110–160, RR 40–60, temperature 36.5–37.5 °C, SpO₂ ≥ 95%, CRT < 3 s on the sternum.", finding: "Temp 36.9 °C, HR 138/min, RR 46/min, SpO₂ 98%, CRT 2 s.", key: true },
      { g: "General inspection", step: "Colour: how far does the jaundice extend?", how: "Blanch the skin with a finger on the forehead, sternum, abdomen and shin (Kramer zones). Look at the sclerae, palms and soles.", finding: "Yellow on blanching over face and chest down to the umbilicus. Legs, palms and soles are pink. No pallor, no cyanosis, no plethora.", key: true, abnormal: true },
      { g: "General inspection", step: "Activity, cry, posture and tone", how: "Watch before handling: spontaneous symmetrical movement, flexed posture, strong cry.", finding: "Alert, vigorous cry, moves all four limbs equally, normal flexed posture.", key: true },
      { g: "General inspection", step: "Skin", how: "Look for rashes, bruising, petechiae, birthmarks.", finding: "Erythema toxicum on the trunk (normal). Blue-grey patch over the sacrum (congenital dermal melanocytosis, normal). No bruising or petechiae." },
      { g: "Head and face", step: "Fontanelles, sutures and scalp", how: "Feel the anterior fontanelle with the baby upright and quiet: soft and flat is normal. Feel for swellings: a cephalohaematoma does not cross suture lines; caput does.", finding: "Anterior fontanelle soft and flat, about 2 × 2 cm. Sutures normal. No cephalohaematoma or caput.", key: true },
      { g: "Head and face", step: "Eyes: red reflex", how: "Ophthalmoscope from 30 cm, both eyes. An absent or white reflex means cataract or retinoblastoma.", finding: "Red reflex present and equal in both eyes. Sclerae yellow.", key: true, abnormal: true },
      { g: "Head and face", step: "Face, ears and mouth: palate", how: "Look for dysmorphic features and ear position. Look at the palate with a torch and feel it with a clean finger for a cleft; check the suck.", finding: "No dysmorphism. Ears normally set. Palate intact. Strong suck.", key: true },
      { g: "Chest and heart", step: "Chest inspection", how: "Look for recession, nasal flaring, grunting and chest symmetry.", finding: "No recession, flaring or grunting. Symmetrical chest movement." },
      { g: "Chest and heart", step: "Auscultate the heart and lungs", how: "Listen at all four areas and the back. Soft systolic murmurs can be normal in the first days; note S2 and any murmur.", finding: "Heart sounds normal, no murmur. Good air entry both sides.", key: true },
      { g: "Chest and heart", step: "Femoral pulses", how: "Hips abducted, fingertip over the mid-inguinal point on both sides. Weak or absent femorals suggest coarctation.", finding: "Both femoral pulses easily felt and equal.", key: true },
      { g: "Abdomen", step: "Inspect the abdomen and umbilical cord", how: "Look for distension. Check the cord stump: redness spreading onto the skin or discharge means omphalitis.", finding: "Abdomen soft, not distended. Cord clean and dry, no redness.", key: true },
      { g: "Abdomen", step: "Palpate liver, spleen and kidneys", how: "Start in the right iliac fossa and move up. A liver edge 1–2 cm below the costal margin is normal in a newborn. A palpable spleen is not.", finding: "Liver edge 1 cm below the costal margin, soft. Spleen not palpable. No masses.", key: true },
      { g: "Genitalia and anus", step: "Genitalia and anus", how: "Girls: labia and vaginal opening (white discharge or a little bleeding is normal). Boys: both testes down, urethral opening at the tip. Check the anus is present, patent and normally placed.", finding: "Normal female genitalia with a small white discharge. Anus patent and normally positioned.", key: true },
      { g: "Hips, spine and limbs", step: "Hips: Barlow and Ortolani", how: "One hip at a time on a relaxed baby. Barlow: adduct and push back, feel for the hip slipping out. Ortolani: abduct with a lift, feel for a clunk as it relocates. Also check equal abduction and leg length.", finding: "Barlow and Ortolani negative both sides. Full symmetrical abduction.", key: true },
      { g: "Hips, spine and limbs", step: "Spine", how: "Turn the baby prone over your hand. Look and feel down the whole spine for dimples, hair tufts, swellings.", finding: "Straight spine. No sacral dimple or hair tuft.", key: true },
      { g: "Hips, spine and limbs", step: "Limbs, hands and feet; clavicles", how: "Count digits, look at palmar creases, check feet for talipes. Feel both clavicles for a fracture.", finding: "Ten fingers and toes, normal creases. Feet normal. Clavicles intact." },
      { g: "Neurology", step: "Tone: ventral suspension and head lag", how: "Hold the baby prone on your hand: a normal baby holds the head briefly in line. Pull to sit to assess head lag.", finding: "Good tone in ventral suspension; mild head lag appropriate for age.", key: true },
      { g: "Neurology", step: "Primitive reflexes: Moro, grasp, suck, rooting", how: "Moro: support the head, let it drop a few centimetres: arms abduct and extend, then come together. It must be symmetrical.", finding: "Symmetrical Moro. Strong palmar grasp, suck and rooting.", key: true },
    ],
    options: ["Physiological jaundice", "ABO haemolytic disease", "Early-onset neonatal sepsis", "Biliary atresia", "Breastfeeding failure jaundice with dehydration"],
    answer: 0,
    whyDx: [
      "Onset on day 3 (after 24 h) in a term baby who is well, feeding and active.",
      "Jaundice only to the umbilicus; no pallor, no hepatosplenomegaly, normal tone and cry.",
      "Mother is A positive, so ABO or Rh incompatibility is unlikely; stools are pigmented and urine is pale.",
      "Weight loss 6% with 4–5 wet nappies: intake is adequate.",
    ],
    notThis: [
      { dx: "ABO haemolytic disease", why: "Usually starts in the first 24 hours with a group O mother; there may be pallor." },
      { dx: "Early-onset neonatal sepsis", why: "No risk factors (GBS negative, no fever, membranes ruptured 6 h) and the baby is well with normal observations." },
      { dx: "Biliary atresia", why: "Presents as prolonged jaundice (> 2 weeks) with pale stools and dark urine; her stools are pigmented." },
      { dx: "Breastfeeding failure jaundice with dehydration", why: "Weight loss is under 10% with good urine output and frequent effective feeds." },
    ],
    tests: "Transcutaneous bilirubin now; if above the threshold for a serum check, total and conjugated serum bilirubin plotted on the hour-specific treatment chart. Blood group and direct Coombs test and FBC only if the level is near the treatment line.",
    manage: "Reassure. Continue breastfeeding 8–12 times a day with feeding support. Recheck bilirubin within 24 hours and plot it. Phototherapy only if it crosses the treatment line. Tell the parents to return for poor feeding, sleepiness, pale stools or jaundice lasting beyond 2 weeks.",
    present: "Lili is a 3-day-old term girl, born by normal delivery at 39+4 weeks with good Apgar scores, who became jaundiced on day 3. She is breastfeeding well with good urine output and pigmented stools, and there are no risk factors for sepsis or haemolysis; the mother is A positive. On examination she is alert and well with normal observations, jaundiced to the umbilicus, with 6% weight loss, no pallor and no hepatosplenomegaly; the rest of the newborn examination is normal. The most likely diagnosis is physiological jaundice. I would measure a bilirubin, plot it on the treatment chart, and support feeding.",
  },
  {
    id: "teen",
    name: "Bence",
    age: "14 years old",
    kind: "Adolescent",
    who: "Bence (mother present)",
    intro: "Paediatric admissions unit. Bence, 14, has come with his mother because of fever and cough. He is sitting on the bed looking tired.",
    opening: "Hi. I've had a fever and a bad cough for a few days, and now it hurts here on the right when I breathe.",
    history: [
      { g: "Presenting complaint", q: "When did this start, and what came first?", a: "Four days ago with a runny nose and a sore throat. The fever and cough started two days ago and got worse.", key: true },
      { g: "Presenting complaint", q: "How high has the fever been? Any shivering?", a: "Up to 39.5. Last night I was shaking and couldn't get warm.", key: true, why: "High fever with rigors points to a bacterial cause." },
      { g: "Presenting complaint", q: "Tell me about the cough. Do you bring anything up?", a: "It was dry at first. Now I cough up yellow-green stuff. No blood.", key: true },
      { g: "Presenting complaint", q: "Tell me about the chest pain: where, what makes it worse?", a: "Right side, low down at the back. It's sharp and worse when I breathe in deeply or cough.", key: true, why: "Pleuritic pain: inflammation reaching the pleura." },
      { g: "Presenting complaint", q: "Are you short of breath? At rest or when moving?", a: "I get out of breath walking to the bathroom. Lying still is OK.", key: true },
      { g: "Presenting complaint", q: "Any wheeze, tummy pain, vomiting or diarrhoea?", a: "No wheeze. My tummy hurt a bit on the right yesterday and I vomited once after coughing.", why: "Lower-lobe pneumonia can present as abdominal pain." },
      { g: "Presenting complaint", q: "Are you eating and drinking? Passing urine normally?", a: "Not hungry, but I'm drinking. I'm peeing less than usual and it's darker.", key: true, why: "Hydration decides whether oral treatment is possible." },
      { g: "Presenting complaint", q: "Has anyone around you been ill?", a: "Half my class had a cold last week.", why: "Contacts and outbreaks (Mycoplasma, influenza) change the likely organism." },
      { g: "Presenting complaint", q: "What have you taken for it? Did it help?", a: "Paracetamol. It brings the fever down for a few hours.", key: true },
      { g: "Past history", q: "Any long-term illnesses, like asthma? Any previous pneumonia or hospital stays?", a: "No asthma. I've never been in hospital.", key: true, why: "Recurrent pneumonia would make you think of CF, immunodeficiency or a foreign body." },
      { g: "Past history", q: "Any operations?", a: "No." },
      { g: "Past history", q: "Do you take any regular medicines? Any allergies, especially to antibiotics?", a: "No regular medicines. I got a rash with penicillin when I was small, my mum says.", key: true, why: "Changes the antibiotic choice." },
      { g: "Past history", q: "Are your vaccinations up to date?", a: "Mum says yes, everything on the schedule.", key: true, why: "Pneumococcal and Hib vaccines change the likely organisms." },
      { g: "Past history", q: "(To mother) Any problems at birth or with growth and development?", a: "Born at term, no problems. He's always grown well and done fine at school." },
      { g: "Family and social", q: "Any illnesses in the family: asthma, TB, cystic fibrosis?", a: "My dad has hay fever. Nobody has TB or anything like that.", key: true },
      { g: "Family and social", q: "Who lives at home? Does anyone smoke indoors? Any pets?", a: "Mum, dad and my little sister. Dad smokes on the balcony. We have a cat.", key: true },
      { g: "Family and social", q: "Any travel abroad recently?", a: "No.", why: "Travel changes the differential (TB, atypical organisms)." },
      { g: "HEADSSS (alone with Bence)", q: "I ask everyone your age a few private questions. Is it OK if we talk for a minute without your mum? What we say stays between us unless you're in danger.", a: "Yeah, that's fine.", key: true, why: "Adolescents get time alone, with confidentiality and its limits explained first." },
      { g: "HEADSSS (alone with Bence)", q: "Home and school: how are things at home? How is school going?", a: "Home's fine. School's OK, I'm in year 9, grades are good. I missed this week.", key: true },
      { g: "HEADSSS (alone with Bence)", q: "Activities: what do you do in your free time?", a: "Football twice a week and gaming with friends." },
      { g: "HEADSSS (alone with Bence)", q: "Drugs: do you or your friends smoke, vape or drink? Tried anything else?", a: "I tried a vape a couple of times at a party. I don't smoke or drink.", key: true, why: "Vaping matters with a lung illness, and adolescents rarely volunteer it with a parent present." },
      { g: "HEADSSS (alone with Bence)", q: "Sexuality: are you in a relationship? Have you been sexually active?", a: "No girlfriend. No.", why: "Ask in a neutral way; it is part of every adolescent history." },
      { g: "HEADSSS (alone with Bence)", q: "Mood and safety: how has your mood been? Ever felt so low you thought of hurting yourself? Do you feel safe at home and school?", a: "Mood's normal, just tired of being sick. No, never. Yes, I feel safe.", key: true },
      { g: "Ideas and concerns", q: "What are you most worried about?", a: "I've got a football tournament next week. And mum's worried it's something serious.", why: "Ideas, concerns and expectations: examiners listen for this." },
    ],
    exam: [
      { g: "Before you touch", step: "Wash hands, introduce yourself, consent, offer a chaperone, position at 45°, expose the chest", how: "Explain what you will do and ask Bence directly, not only his mother. Preserve dignity: expose only what you need.", finding: "Bence agrees. He sits at 45° with his chest exposed.", key: true },
      { g: "Before you touch", step: "Vital signs and growth", how: "Normal for 14 years: HR 60–100, RR 12–20, BP about 110/70. Plot height and weight.", finding: "Temp 39.1 °C, HR 112/min, RR 28/min, BP 112/68, SpO₂ 93% in air, CRT 2 s. Height and weight on the 50th centile.", key: true, abnormal: true },
      { g: "Inspection", step: "General inspection from the end of the bed", how: "Well or unwell, colour, work of breathing, speaking in full sentences, sputum pot, inhalers, oxygen.", finding: "Flushed and tired but alert. Speaks in full sentences. Breathing is fast and shallow; he holds his right side when he coughs.", key: true, abnormal: true },
      { g: "Inspection", step: "Hands", how: "Clubbing (look at the nail-bed angle), peripheral cyanosis, tremor, warmth.", finding: "Warm hands. No clubbing, no cyanosis.", key: true },
      { g: "Inspection", step: "Face and neck", how: "Tongue for central cyanosis, conjunctivae for pallor, throat, cervical lymph nodes.", finding: "No central cyanosis or pallor. Throat mildly red. A few small tender cervical nodes." },
      { g: "Inspection", step: "Chest: shape, scars, movement, recession", how: "Look from the front and back. Compare the two sides during a deep breath.", finding: "Normal shape, no scars. The right lower chest moves less than the left. Mild intercostal recession.", key: true, abnormal: true },
      { g: "Palpation", step: "Trachea and apex beat", how: "One finger in the sternal notch either side of the trachea. Apex normally 5th intercostal space, mid-clavicular line.", finding: "Trachea central. Apex beat not displaced.", key: true },
      { g: "Palpation", step: "Chest expansion", how: "Hands around the lower chest, thumbs meeting in the midline; ask for a deep breath and watch the thumbs separate.", finding: "Reduced expansion on the right.", key: true, abnormal: true },
      { g: "Palpation", step: "Tactile vocal fremitus", how: "Ulnar border of the hand on the chest, ask him to say a low resonant word; compare sides. Increased over consolidation, decreased over an effusion.", finding: "Increased over the right lower zone at the back.", key: true, abnormal: true },
      { g: "Percussion", step: "Percuss front, sides and back, comparing sides", how: "Finger flat in an intercostal space, strike its middle phalanx. Resonant is normal; dull = consolidation; stony dull = effusion; hyperresonant = pneumothorax.", finding: "Dull over the right lower zone posteriorly. Resonant elsewhere. Not stony dull.", key: true, abnormal: true },
      { g: "Auscultation", step: "Breath sounds, all zones, comparing sides", how: "Diaphragm, ask him to breathe in and out through an open mouth. Vesicular is normal; bronchial breathing = consolidation.", finding: "Bronchial breathing over the right lower zone. Normal vesicular breathing elsewhere.", key: true, abnormal: true },
      { g: "Auscultation", step: "Added sounds: crackles, wheeze, pleural rub", how: "Listen through inspiration and expiration at each site.", finding: "Coarse inspiratory crackles at the right base. No wheeze. No pleural rub.", key: true, abnormal: true },
      { g: "Auscultation", step: "Vocal resonance", how: "Stethoscope on the chest while he says a low resonant word; whispering pectoriloquy if increased.", finding: "Increased at the right base with whispering pectoriloquy.", abnormal: true },
      { g: "Auscultation", step: "Heart sounds", how: "All four areas; time against the carotid pulse.", finding: "Normal S1 and S2, no murmur. Tachycardic.", key: true },
      { g: "Complete the examination", step: "Abdomen", how: "Lie him flat. Lower-lobe pneumonia can mimic an acute abdomen, so check for tenderness and guarding.", finding: "Soft. Mild tenderness in the right upper quadrant, no guarding. No hepatosplenomegaly.", key: true },
      { g: "Complete the examination", step: "Ears, nose and throat", how: "Leave to the end. Otoscope for both drums; tonsils with a tongue depressor.", finding: "Eardrums normal. Tonsils not enlarged, no exudate." },
      { g: "Complete the examination", step: "Hydration", how: "Mucous membranes, skin turgor, CRT, urine output.", finding: "Dry lips, moist tongue, normal turgor. Mild dehydration.", key: true, abnormal: true },
      { g: "Complete the examination", step: "Thank him, cover him, wash hands, state what you would do next", how: "Offer: sputum pot, temperature chart, peak flow if asthmatic, and plot growth.", finding: "Bence thanks you and asks if he can still play next week.", key: true },
    ],
    options: ["Right lower lobe pneumonia", "Acute asthma attack", "Pleural effusion (empyema)", "Spontaneous pneumothorax", "Acute appendicitis"],
    answer: 0,
    whyDx: [
      "Fever with rigors, productive cough and right-sided pleuritic chest pain after a viral illness.",
      "Tachypnoea and SpO₂ 93%, with reduced expansion on the right.",
      "Right lower zone: dull percussion, increased fremitus, bronchial breathing and coarse crackles = consolidation.",
      "Trachea central, and no wheeze.",
    ],
    notThis: [
      { dx: "Acute asthma attack", why: "No history of asthma and no wheeze; the signs are focal, not bilateral." },
      { dx: "Pleural effusion (empyema)", why: "Percussion would be stony dull with reduced fremitus and absent breath sounds; here fremitus is increased with bronchial breathing." },
      { dx: "Spontaneous pneumothorax", why: "Would be sudden, without fever, and hyperresonant with reduced breath sounds." },
      { dx: "Acute appendicitis", why: "Abdomen is soft without guarding and the chest signs explain the pain; referred pain from a lower-lobe pneumonia." },
    ],
    tests: "Chest X-ray (right lower lobe consolidation, look for an effusion). FBC, CRP, urea and electrolytes, blood culture. Sputum culture if he can produce it. Consider Mycoplasma serology or PCR at his age.",
    manage: "Admit because SpO₂ is below 92–93% with tachypnoea. Oxygen to keep SpO₂ above 92%, fluids, paracetamol or ibuprofen for fever and pain. Antibiotics: amoxicillin is first line, but with a possible penicillin allergy use a macrolide such as clarithromycin (which also covers Mycoplasma) and clarify the allergy. Review at 48 hours: if fever persists, repeat the X-ray or ultrasound for an effusion. Advise against vaping.",
    present: "Bence is a 14-year-old boy, previously well and fully vaccinated, with four days of coryza followed by two days of high fever with rigors, productive cough and right-sided pleuritic chest pain. He has a possible penicillin allergy and has tried vaping. On examination he is febrile at 39.1 °C, tachypnoeic at 28 with saturations of 93% in air. The right lower zone has reduced expansion, a dull percussion note, increased tactile fremitus, bronchial breathing and coarse crackles; the trachea is central. This is consistent with a right lower lobe pneumonia. I would request a chest X-ray and bloods, give oxygen and fluids, and start antibiotics taking his allergy into account.",
  },
];
