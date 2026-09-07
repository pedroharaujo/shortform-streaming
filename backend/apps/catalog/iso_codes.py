"""Assigned ISO codes for fail-closed catalog scope validation.

Snapshot verified 2026-09-07; update through review when the registries change.
Country source: UN M49 ISO-alpha2 column (248 entries), plus ISO-assigned TW:
https://unstats.un.org/unsd/methodology/m49/overview/
https://www.iso.org/obp/ui/#iso:code:3166:TW
https://psi.oasis-open.org/iso/3166/
Language source: current ISO 639-1 column (183 entries; deprecated codes excluded):
https://www.loc.gov/standards/iso639-2/php/code_list.php
https://www.loc.gov/standards/iso639-2/php/code_changes.php

These registries validate scope syntax; they do not authorize any market rollout.
"""

ISO_COUNTRIES = frozenset(
    (
        "AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO "
        "BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ "
        "DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP "
        "GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG "
        "KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML "
        "MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE "
        "PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL "
        "SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM "
        "US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW"
    ).split()
)

ISO_LANGUAGES = frozenset(
    (
        "aa ab ae af ak am an ar as av ay az ba be bg bi bm bn bo br bs ca ce ch co cr cs cu cv "
        "cy da de dv dz ee el en eo es et eu fa ff fi fj fo fr fy ga gd gl gn gu gv ha he hi ho "
        "hr ht hu hy hz ia id ie ig ii ik io is it iu ja jv ka kg ki kj kk kl km kn ko kr ks ku "
        "kv kw ky la lb lg li ln lo lt lu lv mg mh mi mk ml mn mr ms mt my na nb nd ne ng nl nn "
        "no nr nv ny oc oj om or os pa pi pl ps pt qu rm rn ro ru rw sa sc sd se sg si sk sl sm "
        "sn so sq sr ss st su sv sw ta te tg th ti tk tl tn to tr ts tt tw ty ug uk ur uz ve vi "
        "vo wa wo xh yi yo za zh zu"
    ).split()
)
