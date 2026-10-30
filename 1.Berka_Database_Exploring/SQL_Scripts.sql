-- ============================================
-- # DATABASE CONNECTION
-- ============================================
-- Hostname : relational.fel.cvut.cz
-- Port     : 3306
-- Username : guest
-- Password : ctu-relational
-- Database : financial  (Berka Dataset)
-- ============================================



-- The first and last date in the database.
SELECT min(date),max(date)
FROM financial.trans;

-- -------------------------------------

-- ((ACCOUNTS TABLE))
/* Extracted account owner demographics; gender, age, and region. */
SELECT 
    c.account_id AS Account_ID,
	EXTRACT(YEAR FROM c.date) AS Created_Year, 
    p.gender AS Owner_Gender,
    p.birth_date AS Owner_Birth_Date, 
    TIMESTAMPDIFF(YEAR, p.birth_date, '1998-12-31') AS Owner_Age, 
    p.Region
FROM financial.account AS c
LEFT JOIN ( SELECT dis.account_id, dis.disp_id, dis.client_id, dis.type, 
                   cli.gender, cli.birth_date, cli.district_id, 
                   d.A3 AS Region
             FROM financial.disp AS dis
             LEFT JOIN client AS cli ON cli.client_id = dis.client_id
             LEFT JOIN district AS d ON d.district_id = cli.district_id
             WHERE type = 'OWNER' ) AS p ON p.account_id = c.account_id;


-- ----------------------------------------

-- ((REGIONS TABLE))
/* Aggregated district-level data by region to summarize regional socio-economic metrics. */
SELECT 
    A3 AS Region, 
    COUNT(A2) AS Number_Of_District, 
    SUM(A4) AS Total_Population,
    SUM(A11 * A4) / SUM(A4) AS Avg_Salary, 
    (SUM(A14 * A4 /1000) / SUM(A4)) * 1000 AS Entrepreneurs_Per_1000,
    SUM(A10 * A4) / SUM(A4) AS Urban_Ratio, 
    SUM(COALESCE(A15, A16)) AS Num_Crimes_95, 
    SUM(A16) AS Num_Crimes_96,
    avg(A12)   AS Avg_Unemployment_95, 
    avg(A13)  AS Avg_Unemployment_96
FROM financial.district
GROUP BY Region;

-- -------------------------------------------------------------

-- ((ORDERS TABLE))
 /* Aggregated order data by account to summarize payment types and amounts. */
SELECT 
    c.account_id,
    CASE WHEN (ord.Sipo_Order + ord.Uver_Order + ord.Leasing_Order + ord.Pojistne_Order + ord.Other_Order) <> 0 THEN 'yes' ELSE 'No' END AS ORDERS,
    ord.Sipo_Order, 
    ord.Uver_Order, 
    ord.Leasing_Order, 
    ord.Pojistne_Order, 
    ord.Other_Order,
    (ord.Sipo_Order + ord.Uver_Order + ord.Leasing_Order + ord.Pojistne_Order + ord.Other_Order) AS TotalOrder
FROM financial.account AS c
LEFT JOIN ( select account_id,
              sum(case when K_SYMBOL='SIPO' then amount else 0 end) as Sipo_Order,
              sum(case when K_SYMBOL='UVER' then amount else 0 end) as Uver_Order,
              sum(case when K_SYMBOL='LEASING' then amount else 0 end) as Leasing_Order,
              sum(case when K_SYMBOL='POJISTNE' then amount else 0 end) as Pojistne_Order,
              sum(case when K_SYMBOL=' ' then amount else 0 end) as Other_Order
            from financial.order
            group by account_id ) AS ord ON c.account_id = ord.account_id;
 
 
 
 -- ----------------------------------------------------


-- ((LOANS TABLE))
/* Left joined account and loan tables to flag active loans and show loan information. */
SELECT 
    c.account_id AS Account_ID,
    (CASE WHEN l.status IS NULL THEN 'NO' ELSE 'YES' END) AS Loan,
    l.status AS Loan_Status, 
    l.date AS Loan_Date, 
    l.duration AS Loan_Duration, 
    l.payments AS Loan_Payments, 
    l.amount AS loan_Amount
FROM financial.account AS c
LEFT JOIN loan AS l ON l.account_id = c.account_id;


-- -------------------------------------------------------

--  ((ACCOUNTS_INCOME TABLE))
/* Aggregated transaction data using CTEs to show deposit behavior 
   and isolate income streams like salaries and pensions for each account */
WITH
Deposit_amount AS (
     SELECT  account_id,
             COUNT(*) as Deposit_count,
             SUM(amount) as Deposit_total_amount,
             MIN(amount) as Deposit_min_value,
             MAX(amount) as Deposit_max_value,
             ROUND(DATEDIFF(MAX(date), MIN(date)) / 30, 0) AS Deposit_Total_Months,
            CASE 
               WHEN (DATEDIFF(MAX(date), MIN(date)) / 30) > 4 
               THEN SUM(amount) / (DATEDIFF(MAX(date), MIN(date)) / 30) 
               ELSE 0 
		    END  AS  Deposit_monthly_average
     FROM financial.trans
     WHERE type = 'PRIJEM' and operation = 'VKLAD'
     GROUP BY account_id
),
Deposit_mode AS (
    SELECT account_id, amount, 
           COUNT(*) AS mode_count,
           ROW_NUMBER() OVER (PARTITION BY account_id ORDER BY COUNT(*) DESC, amount DESC) as frequency_rank
      FROM financial.trans
      WHERE type = 'PRIJEM' AND operation = 'VKLAD'
      GROUP BY account_id, amount
),
Pension As (
    SELECT account_id, 
            min(amount) as pension
     FROM financial.trans
     where type='PRIJEM' and operation='PREVOD Z UCTU' and K_symbol='DUCHOD' 
     GROUP BY account_id
),
salary as (
	 select account_id, 
            min(amount) as base_salary,
            max(amount) as peak_salary
       from financial.trans  
	   WHERE type = 'PRIJEM' and operation = 'PREVOD Z UCTU' and k_symbol IS NULL
       group by account_id
)

SELECT 
    d.account_id as Account_ID,
    d.Deposit_count,
    d.Deposit_total_amount,
    d.Deposit_min_value,
	d.Deposit_max_value,
    d.Deposit_Total_Months,
    d.Deposit_monthly_average as Deposit_Monthly_Average,
	case when m.mode_count>1 then  m.mode_count else 0 end as mode_count,
    CASE WHEN m.mode_count > 1 THEN CAST(m.amount AS CHAR) ELSE '' END AS Deposit_amount_mode,
    COALESCE(P.pension,0) as Pension,
    COALESCE(s.base_salary,0) as Base_Salary,
    COALESCE(s.peak_salary,0) as Peak_Salary
FROM Deposit_amount as d
  left JOIN Deposit_mode as m on d.account_id = m.account_id and m.frequency_rank = 1
  left JOIN Pension as P on d.account_id = P.account_id
  left JOIN salary as s on d.account_id = s.account_id
 
 -- --------------------------------------------------------------
 
 
  -- ((ACCOUNTS_OUTFLOW TABLE))
  /* Aggregated outgoing transactions using CTEs to show fees, transfers,
    and withdrawals for evaluating client spending behavior and cash flow */
 WITH 
 Fees AS (
         SELECT account_id,
	          MAX(CASE WHEN type='VYDAJ' AND operation='VYBER' AND k_symbol='SLUZBY' THEN amount ELSE 0 END) AS Account_Fees
         FROM financial.trans
         GROUP BY account_id
),
Transfers AS (
   select account_id ,
          ROUND(DATEDIFF(MAX(date), MIN(date)) / 30, 0) AS Transfers_Total_Months,
          sum(amount) as Transfers_Total_amount,
          CASE 
			WHEN ROUND(DATEDIFF(MAX(date), MIN(date)) / 30, 0) > 4
			THEN  sum(amount) / ROUND(DATEDIFF(MAX(date), MIN(date)) / 30, 0) 
			ELSE 0 
		  END AS Transfers_Monthly_Average
    from financial.trans
	where  type ='VYDAJ' and operation='PREVOD NA UCET'
	group by account_id
),   
Withdrawals  AS (
	select   account_id,
             ROUND(DATEDIFF(MAX(date), MIN(date)) / 30, 0) AS Withdrawals_Total_Months,
			 count(amount) as Withdrawals_count,
             sum(amount) as Withdrawals_Total_amount,
             CASE 
				WHEN (DATEDIFF(MAX(date), MIN(date)) / 30) > 4
				THEN SUM(amount) / (DATEDIFF(MAX(date), MIN(date)) / 30) 
				ELSE 0 
	         END AS Withdrawals_Monthly_Average
	   from financial.trans 
      WHERE type IN ('VYDAJ', 'VYBER') AND operation IN ('VYBER', 'VYBER KARTOU') AND (k_symbol <> 'SLUZBY' OR k_symbol IS NULL OR k_symbol = '')
      group by account_id
 )
 
SELECT 
    f.account_id as Account_ID,
    f.Account_Fees ,
    COALESCE(t.Transfers_Total_Months,0) as Transfers_Total_Months,
    COALESCE(t.Transfers_Total_amount,0) as Transfers_Total_amount,
    COALESCE(t.Transfers_Monthly_Average,0) as Transfers_Monthly_Average ,
    COALESCE(w.Withdrawals_Total_Months,0) as Withdrawals_Total_Months ,
    COALESCE(w.Withdrawals_count,0) as Withdrawals_count,
    COALESCE(w.Withdrawals_Total_amount,0) as Withdrawals_Total_amount,
    COALESCE(w.Withdrawals_Monthly_Average ,0) as Withdrawals_Monthly_Average
 FROM Fees as  f 
   LEFT JOIN Transfers as t ON t.account_id = f.account_id
   LEFT JOIN Withdrawals as w ON w.account_id = f.account_id;
    
    
    -- --------------------------------------------------------------
    
	
-- ((BALANCES TABLE))
/* Aggregated monthly transaction data to calculate total inflows, 
outflows, and net monthly balance per client account. */

select d.account_id as Account_ID, d.date , d.yr as year, d.mon as month ,
 sum(d.montly_inflow) as Montly_Inflow, 
 sum(d.monthly_outflow) as Monthly_Outflow,
 sum(d.montly_inflow) -  sum(d.monthly_outflow)  as Net_Monthly_Balance 
 from  ( SELECT  account_id, date,
                EXTRACT(YEAR FROM date) AS yr, 
                EXTRACT(MONTH FROM date) AS mon,
                type,
                case when type ='PRIJEM' then sum(amount)  else 0 end AS montly_inflow, 
				case when type IN ('VYDAJ', 'VYBER') then sum(amount)  else 0 end AS monthly_outflow,
                sum(amount) AS total
		    FROM financial.trans
		    GROUP BY account_id,yr,mon ,type
	        order by account_id ,yr,mon  )   as d
group by d.account_id ,d.yr,d.mon;




 
 
 
 
 


