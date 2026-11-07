# Berka Database · Part 2: Loan Analysis

Can a bank tell, **before** granting a loan, whether the client will repay it or default? This project uses the known previous loan outcomes of the Berka database (a real Czech bank, 1993–1998) to answer that question.




**This project delivers two things :**

• A clear, interpretable model of loan default, built and tested step by step.

• A set of practical lending observations that the bank can act on.


**What I did :**

• Built a dataset of 279 loans with known outcomes (good or bad), using only information available before each loan was granted.

• Explored how loan, account and client-behavior features relate to default.

• Built and tested a logistic regression model with cross-validation, then simplified it to the few variables that matter.

• Turned the results into practical lending observations.



*The final model uses four variables and reaches a cross-validated AUC of about 0.83.*

 [**Full Report**](Project_Report.pdf)

 
 [**LoanAnalysis Notebook**](https://colab.research.google.com/github/aliabedalkereem-byte/Data-Analytics-Portfolio/blob/main/2.Berka_Database_LoanAnalysis/LoanAnalysis.ipynb)
[![Open in colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/aliabedalkereem-byte/Data-Analytics-Portfolio/blob/main/2.Berka_Database_LoanAnalysis/LoanAnalysis.ipynb)


---

## Repository
```
LoanAnalysis.ipynb    full analysis
Project_Report.pdf     full report
```

**Tools:** Python (pandas, NumPy, statsmodels, scikit-learn, Matplotlib) · Google Colab · GitHub
