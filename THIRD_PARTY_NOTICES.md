# Third-party notices

CareThread uses the following direct runtime packages. Versions and license identifiers below were checked against the installed package metadata for this local implementation on 25 September 2026; `package-lock.json` records the resolved dependency tree. This notice does not assign a license to CareThread's own code.

| Package | Installed version | Declared license | Local license source after `npm ci` |
| --- | --- | --- | --- |
| `@fontsource/manrope` | 5.3.0 | SIL Open Font License 1.1 (`OFL-1.1`) | `node_modules/@fontsource/manrope/LICENSE` |
| `lucide-react` | 0.468.0 | ISC | `node_modules/lucide-react/LICENSE` |
| `react` | 19.3.0 | MIT | `node_modules/react/LICENSE` |
| `react-dom` | 19.3.0 | MIT | `node_modules/react-dom/LICENSE` |
| `idb` | 8.0.3 | ISC | `node_modules/idb/LICENSE` |
| `pdf-lib` | 1.17.1 | MIT | `node_modules/pdf-lib/LICENSE.md` |
| `@pdf-lib/fontkit` | 1.1.1 | MIT | `node_modules/@pdf-lib/fontkit/package.json`; [upstream repository](https://github.com/Hopding/fontkit) |
| `pdfjs-dist` | 6.3.289 | Apache License 2.0 | `node_modules/pdfjs-dist/LICENSE` |

React and React DOM carry copyright notices for Meta Platforms, Inc. and affiliates. PDF-lib carries Copyright (c) 2019 Andrew Dillon. IDB carries Copyright (c) 2016, Jake Archibald. Keep the corresponding upstream license and copyright notices when redistributing those components. Fontkit's installed package declares MIT in its metadata but does not include a separate top-level license file.

The package tree also contains transitive code, including `@pdf-lib/standard-fonts` 1.0.0 (MIT), `@pdf-lib/upng` 1.0.1 (MIT), `pako` 1.0.11 (MIT AND Zlib), `tslib` 1.14.1 (0BSD), and `scheduler` 0.28.0 (MIT). Their original notices remain with their installed packages. This is an inventory of the direct runtime packages and selected transitive packages, not a claim of an exhaustive redistribution audit. Build and test tools have their own package licenses.

## Manrope font

The app bundles Manrope font files locally for interface text and PDF export. The full notice below is reproduced from the installed font package. The font license does not require documents created with the font to use that same license.

```text
Copyright 2019 The Manrope Project Authors (https://github.com/sharanda/manrope)

This Font Software is licensed under the SIL Open Font License, Version 1.1.
This license is copied below, and is also available with a FAQ at:
http://scripts.sil.org/OFL


-----------------------------------------------------------
SIL OPEN FONT LICENSE Version 1.1 - 26 February 2007
-----------------------------------------------------------

PREAMBLE
The goals of the Open Font License (OFL) are to stimulate worldwide
development of collaborative font projects, to support the font creation
efforts of academic and linguistic communities, and to provide a free and
open framework in which fonts may be shared and improved in partnership
with others.

The OFL allows the licensed fonts to be used, studied, modified and
redistributed freely as long as they are not sold by themselves. The
fonts, including any derivative works, can be bundled, embedded,
redistributed and/or sold with any software provided that any reserved
names are not used by derivative works. The fonts and derivatives,
however, cannot be released under any other type of license. The
requirement for fonts to remain under this license does not apply
to any document created using the fonts or their derivatives.

DEFINITIONS
"Font Software" refers to the set of files released by the Copyright
Holder(s) under this license and clearly marked as such. This may
include source files, build scripts and documentation.

"Reserved Font Name" refers to any names specified as such after the
copyright statement(s).

"Original Version" refers to the collection of Font Software components as
distributed by the Copyright Holder(s).

"Modified Version" refers to any derivative made by adding to, deleting,
or substituting -- in part or in whole -- any of the components of the
Original Version, by changing formats or by porting the Font Software to a
new environment.

"Author" refers to any designer, engineer, programmer, technical
writer or other person who contributed to the Font Software.

PERMISSION & CONDITIONS
Permission is hereby granted, free of charge, to any person obtaining
a copy of the Font Software, to use, study, copy, merge, embed, modify,
redistribute, and sell modified and unmodified copies of the Font
Software, subject to the following conditions:

1) Neither the Font Software nor any of its individual components,
in Original or Modified Versions, may be sold by itself.

2) Original or Modified Versions of the Font Software may be bundled,
redistributed and/or sold with any software, provided that each copy
contains the above copyright notice and this license. These can be
included either as stand-alone text files, human-readable headers or
in the appropriate machine-readable metadata fields within text or
binary files as long as those fields can be easily viewed by the user.

3) No Modified Version of the Font Software may use the Reserved Font
Name(s) unless explicit written permission is granted by the corresponding
Copyright Holder. This restriction only applies to the primary font name as
presented to the users.

4) The name(s) of the Copyright Holder(s) or the Author(s) of the Font
Software shall not be used to promote, endorse or advertise any
Modified Version, except to acknowledge the contribution(s) of the
Copyright Holder(s) and the Author(s) or with their explicit written
permission.

5) The Font Software, modified or unmodified, in part or in whole,
must be distributed entirely under this license, and must not be
distributed under any other license. The requirement for fonts to
remain under this license does not apply to any document created
using the Font Software.

TERMINATION
This license becomes null and void if any of the above conditions are
not met.

DISCLAIMER
THE FONT SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO ANY WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT
OF COPYRIGHT, PATENT, TRADEMARK, OR OTHER RIGHT. IN NO EVENT SHALL THE
COPYRIGHT HOLDER BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
INCLUDING ANY GENERAL, SPECIAL, INDIRECT, INCIDENTAL, OR CONSEQUENTIAL
DAMAGES, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF THE USE OR INABILITY TO USE THE FONT SOFTWARE OR FROM
OTHER DEALINGS IN THE FONT SOFTWARE.
```

## Lucide icons

The icon component library's notice is reproduced from the installed package.

```text
ISC License

Copyright (c) for portions of Lucide are held by Cole Bemis 2013-2022 as part of Feather (MIT). All other copyright (c) for Lucide are held by Lucide Contributors 2022.

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
```


## Landing-page photography

“[A Medical Practitioner Showing a Patient Paper](https://www.pexels.com/photo/a-medical-practitioner-showing-a-patient-paper-7578808/)” by **cottonbro studio**, from Pexels, is used under the [Pexels License](https://www.pexels.com/license/). The website serves resized and cropped WebP/JPEG versions from `public/images/`. It is illustrative photography and does not imply endorsement.
