
/* This project analyzes "rental activity" in the Sakila DVD Rental Business,
 focusing on film demand and repeat customer behavior across two store locations */ 

USE sakila;


/*  Rental full view  (understanding the rental system structures) */
SELECT 
DATE(r.rental_date) AS RentalDate , f.title AS FilmTitle , c.name AS FilmCategory  , concat(CU.first_name,'  ',cu.last_name ) AS CustomerName , ci.city AS StoreCity 
FROM rental AS r

--  product details
JOIN  inventory     AS   inv   ON   inv.inventory_id=r.inventory_id
JOIN  film          AS   f     ON   f.film_id=inv.film_id
JOIN  film_category AS   fc    ON   fc.film_id=f.film_id
JOIN  category      AS   c     ON   c.category_id=fc.category_id

-- store & customer
JOIN  customer  AS   cu    ON   cu.customer_id=r.customer_id
JOIN  store     As   st   ON   st.store_id=cu.store_id
JOIN  address   AS   ad    ON   ad.address_id=st.address_id
JOIN  city      AS   ci   ON   ci.city_id=ad.city_id;
----------------------------------------------------------------------------------------------
----------------------------------------------------------------------------------------------
/* Exploring films in the Inventory  */

SELECT 
f.title AS FilmName , c.name AS FilmCategory , count(r.rental_id) AS TotalRentals
FROM  inventory AS i

JOIN film          AS f  ON f.film_id=i.film_id
JOIN film_category AS fc ON fc.film_id=f.film_id
JOIN category      AS c  ON c.category_id=fc.category_id

LEFT JOIN rental   AS  r  ON  r.inventory_id=i.inventory_id 

GROUP BY FilmName , FilmCategory
ORDER BY TotalRentals ASC ;

