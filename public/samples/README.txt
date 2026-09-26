CARETHREAD SYNTHETIC DEVELOPMENT SOURCES
These files contain fictional administrative information and no clinical values.
They are known development fixtures, not real medical records or held-out evaluation data.

order.pdf: Three test orders for the September visit.
blood-count-current.pdf: A current report referring to order CT-O-01.
metabolic-panel-partial.pdf: A report explicitly marked partial, for order CT-O-02.
blood-count-older.pdf: A July report with a different episode and order identifier.
culture-returning.pdf: Add later to review the previously unlinked culture order.
wrong-person.pdf: A synthetic identity conflict that must be kept out of the active episode.
scan-only.pdf: An image-only PDF for testing the manual-entry fallback.
order-change.pdf: An explicit cancellation of CT-O-03 and a separate new Culture order CT-O-04.
metabolic-panel-amended.pdf: A report explicitly stating it supersedes CT-R-12; review is still required.

The initial demo uses order.pdf, blood-count-current.pdf, metabolic-panel-partial.pdf and blood-count-older.pdf.
Import culture-returning.pdf later to try the return-and-review workflow.
scan-only.pdf deliberately contains an image with no selectable text. It tests manual fallback, not OCR.
No source document establishes clinician review, completed care or a medical interpretation.