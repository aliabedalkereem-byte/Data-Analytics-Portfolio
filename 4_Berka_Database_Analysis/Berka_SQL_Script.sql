-- ============================================
-- DATABASE CONNECTION
-- ============================================
-- Hostname : relational.fel.cvut.cz
-- Port     : 3306
-- Username : guest
-- Password : ctu-relational
-- Database : financial  (Berka Dataset)
-- ============================================


-- (( BASIC )) 
SELECT
 c.account_id, c.frequency , extract(year from c.date ) as Createdyear, 
 d.A3 as region,
 p.gender as owner_gender, p.birth_date as owner_birth_date,  TIMESTAMPDIFF(YEAR, p.birth_date, '1998-12-31') as owner_age,
    CASE   WHEN TIMESTAMPDIFF(YEAR, p.birth_date, '1998-12-31')  < 25 THEN 'Young'
           WHEN TIMESTAMPDIFF(YEAR, p.birth_date, '1998-12-31') BETWEEN 25 AND 40 THEN 'Adult'
           WHEN TIMESTAMPDIFF(YEAR, p.birth_date, '1998-12-31')  BETWEEN 41 AND 60 THEN 'Middle Aged'
           WHEN TIMESTAMPDIFF(YEAR, p.birth_date, '1998-12-31')  > 60 THEN 'Pensioner'
	  END as age_group
from financial.account as c
   join district as d  on  d.district_id=c.district_id
   left join (  select di.account_id,di.disp_id,di.client_id,di.type,c.gender,c.birth_date
                from financial.disp as di
                left join client as c on c.client_id=di.client_id
				where type='OWNER' 
                )   as p on p.account_id=c.account_id;


-- The last date in the database
SELECT max(date)
FROM financial.trans;



 -- ((REGION))
 select   A3 as region, count(A2) as NumberOfDistrict, sum(A4) as total_population, 
 (SUM(A11 * A4) / SUM(A4)) as avg_salary, (SUM(A14 * A4 / 1000) / SUM(A4) )* 1000 as entrepreneurs_per_1000,
 (SUM(A10 * A4) / SUM(A4)) as urban_ratio, SUM(COALESCE(A15, A16)) as num_crimes_95, sum(A16) as num_crimes_96,
 (SUM(A12 * A4) / SUM(IF(A12 IS NULL, 0, A4))) as avg_unemployment_95, (SUM(A13 * A4) / SUM(A4)) as avg_unemployment_96 
 from financial.district
 group by   region;
 
 

 

-- ((ORDER))
SELECT c.account_id,
  case when (ord.Sipo_Order + ord.Uver_Order + ord.Leasing_Order + ord.Pojistne_Order + ord.Other_Order) <>0 then 'yes' else 'No' end as ORDERS ,
  ord.Sipo_Order, ord.Uver_Order, ord.Leasing_Order, ord.Pojistne_Order, ord.Other_Order,
  (ord.Sipo_Order + ord.Uver_Order + ord.Leasing_Order + ord.Pojistne_Order + ord.Other_Order) AS TotalOrder
from financial.account as c
 left join (
             select  account_id, 
		        sum( case when K_SYMBOL='SIPO' then amount else 0 end) as Sipo_Order,
                sum(case when K_symbol='UVER' then amount else 0 end) as Uver_Order,
                sum( case when K_symbol='LEASING' then amount else 0 end ) as Leasing_Order,
		        sum(case when K_symbol='POJISTNE' then amount else 0 end ) as Pojistne_Order,
                sum(case when K_symbol=' ' then amount else 0 end ) as Other_Order
             from financial.order
                group by account_id
        ) as ord on c.account_id=ord.account_id;
 




-- ((LOAN))
SELECT c.account_id,
    (case when  l.status is NULL then 'NO' else 'YES' end) as Loan ,
    l.status as LoanStatus, l.date as LoanDate ,l.duration as LoanDuration, l.payments as LoanPayments, l.amount as loanAmount 
from financial.account as c
  left join loan as l on l.account_id=c.account_id;




-- Transfer/Cash  ((IN))
WITH
-- D : deposit
D_mode AS (
    SELECT account_id, amount, COUNT(*) AS D_count_of_the_mode,
     ROW_NUMBER() OVER (PARTITION BY account_id ORDER BY COUNT(*) DESC, amount DESC) as frequency_rank
    FROM financial.trans
     WHERE type = 'PRIJEM' AND operation = 'VKLAD'
     GROUP BY account_id, amount
),

D_amount AS (
    SELECT  account_id,
        MIN(amount) as D_min_val,
        MAX(amount) as D_max_val,
        COUNT(*) as D_total_count,
        ROUND(DATEDIFF(MAX(date), MIN(date)) / 30, 0) AS D_Total_Months,
		SUM(amount) as Total_D,
        CASE 
            WHEN (DATEDIFF(MAX(date), MIN(date)) / 30) > 4 
            THEN SUM(amount) / (DATEDIFF(MAX(date), MIN(date)) / 30) 
            ELSE 0 
		END AS D_monthly_average
    FROM financial.trans
    WHERE type = 'PRIJEM' and operation = 'VKLAD'
    GROUP BY account_id
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
    d.account_id,
    d.D_total_count,
    d.D_Total_Months,
    d.Total_D,
    d.D_monthly_average,
    d.D_min_val,
    d.D_max_val,
	case when m.D_count_of_the_mode>1 then  m.D_count_of_the_mode else 0 end as D_count_of_the_mode,
    CASE WHEN m.D_count_of_the_mode > 1 THEN CAST(m.amount AS CHAR) ELSE '' END AS D_amount_mode,
    COALESCE(P.pension,0) as Pension,
    COALESCE(s.base_salary,0) as Base_Salary,
    COALESCE(s.peak_salary,0) as Peak_Salary
FROM D_amount as d
  left JOIN D_mode as m on d.account_id = m.account_id and m.frequency_rank = 1
  left JOIN Pension as P on d.account_id = P.account_id
  left JOIN salary as s on d.account_id = s.account_id
 
 
 
 
  -- Transfer/Cash  ((OUT))
 WITH 
Transfer AS (
   select account_id ,
          ROUND(DATEDIFF(MAX(date), MIN(date)) / 30, 0) AS T_Total_Months,
          sum(amount) as T_Total_amount,
          CASE 
	           WHEN ROUND(DATEDIFF(MAX(date), MIN(date)) / 30, 0) > 4
	           THEN    sum(amount) / ROUND(DATEDIFF(MAX(date), MIN(date)) / 30, 0) 
	           ELSE 0 
		  END AS T_monthly_average

    from financial.trans
	where  type ='VYDAJ' and operation='PREVOD NA UCET'
	group by account_id
),   
Fees AS (
         SELECT account_id,
	MAX(CASE WHEN type='VYDAJ' AND operation='VYBER' AND k_symbol='SLUZBY' THEN amount ELSE 0 END) AS FeesOnTheAccount
        FROM financial.trans
        GROUP BY account_id
),
Withdrawal  AS (
     select account_id,
            ROUND(DATEDIFF(MAX(date), MIN(date)) / 30, 0) AS W_Total_Months,
			count(amount) as W_count,
            sum(amount) as W_Total_amount,
            CASE 
	             WHEN (DATEDIFF(MAX(date), MIN(date)) / 30) > 4
	             THEN SUM(amount) / (DATEDIFF(MAX(date), MIN(date)) / 30) 
	             ELSE 0 
	        END AS W_monthly_average

	   from financial.trans 
      WHERE type IN ('VYDAJ', 'VYBER') 
  AND operation IN ('VYBER', 'VYBER KARTOU') 
  AND (k_symbol <> 'SLUZBY' OR k_symbol IS NULL OR k_symbol = '')
      group by account_id

 )
SELECT 
 f.account_id ,
 f.FeesOnTheAccount ,
  COALESCE(t.T_Total_Months,0) as T_Total_Months,
  COALESCE(t.T_Total_amount ,0) as T_Total_amount,
  COALESCE(t.T_monthly_average,0) as T_monthly_average ,
  COALESCE(w.W_Total_Months,0) as W_Total_Months ,
  COALESCE(w.W_count,0) as W_count,
  COALESCE(w.W_Total_amount,0) as W_Total_amount,
  COALESCE(w.W_monthly_average ,0) as W_monthly_average
 
FROM Fees as  f 
   LEFT JOIN Transfer as t ON t.account_id = f.account_id
   LEFT JOIN Withdrawal as w ON w.account_id = f.account_id;
    
    
    
    
	
-- ((BALANCE))
select d.account_id , d.yr, d.mon ,d.date,
 sum(d.m_in) as M_IN ,sum(d.m_out) as M_OUT,  sum(d.m_in) -  sum(d.m_out)   as Balance 

 from (SELECT 
          account_id, date,
          EXTRACT(YEAR FROM date) AS yr, 
          EXTRACT(MONTH FROM date) AS mon,
          type,
          case when type ='PRIJEM' then sum(amount)  else 0 end AS m_in, 
          case when type IN ('VYDAJ', 'VYBER') then sum(amount)  else 0 end AS m_out,
          sum(amount) AS total
		FROM financial.trans
		GROUP BY account_id,yr,mon ,type
	    order by account_id ,yr,mon  )   as d
group by d.account_id ,d.yr,d.mon;




 
 
 
 
 


