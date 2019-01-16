# :cactus: hiervis - Hierarchical visualizations for R/Shiny

"Many datasets are intrinsically hierarchical. Consider geographic entities, such as census blocks, census tracts, counties and states; the command structure of businesses and governments; file systems and software packages. And even non-hierarchical data may be arranged empirically into a hierarchy, as with k-means clustering or phylogenetic trees." [d3-hierarchy README](https://github.com/d3/d3-hierarchy)

Interactive visualization of hierarchical datasets with R and Shiny - includes horizontal and vertial Sankey, Partition, Icicle and Treemap. Based on https://github.com/fbreitwieser/d3-hiervis. 

![hiervis demo](https://user-images.githubusercontent.com/516060/51274893-5b5f2500-199e-11e9-8548-1c861e05e586.png)

## Usage
`hiervis_demo()` showcases the supported visualizations and prints the command to reproduce the visualization. Also works with custom data.

```r
# devtools::install_github("fbreitwieser/hiervis")
library(hiervis)
hiervis_demo()
```

## Detailed usage

Tabular data works with default arguments:
```r
> str(Titanic)
 table [1:4, 1:2, 1:2, 1:2] 0 0 35 0 0 0 17 0 118 154 ...
 - attr(*, "dimnames")=List of 4
  ..$ Class   : chr [1:4] "1st" "2nd" "3rd" "Crew"
  ..$ Sex     : chr [1:2] "Male" "Female"
  ..$ Age     : chr [1:2] "Child" "Adult"
  ..$ Survived: chr [1:2] "No" "Yes"
> hiervis(Titanic, "sankey")
```
![image](https://user-images.githubusercontent.com/516060/50473678-2c1c5000-09be-11e9-8764-3d6920888240.png)

```r
> hiervis(HairEyeColor, "vertical sankey")
> str(HairEyeColor)
 table [1:4, 1:4, 1:2] 32 53 10 3 11 50 10 30 10 25 ...
 - attr(*, "dimnames")=List of 3
  ..$ Hair: chr [1:4] "Black" "Brown" "Red" "Blond"
  ..$ Eye : chr [1:4] "Brown" "Blue" "Hazel" "Green"
  ..$ Sex : chr [1:2] "Male" "Female"
```
![image](https://user-images.githubusercontent.com/516060/50473786-a6e56b00-09be-11e9-8a05-37bc0cd7d78b.png)

For `data.frame`s with a path, specify nameField (with path), pathSep and valueField:
```r
> str(d3_modules)
'data.frame':	463 obs. of  2 variables:
 $ size: int  NA NA NA NA NA NA NA NA NA NA ...
 $ path: chr  "d3" "d3/d3-array" "d3/d3-array/threshold" "d3/d3-axis" ...
> hiervis(d3_modules, "sunburst", nameField = "path", pathSep = "/", valueField = "size")
```
![image](https://user-images.githubusercontent.com/516060/50473845-e0b67180-09be-11e9-87cd-a782f012bc0d.png)

For `data.frame`s with parent-child information, supply nameField and parentField
```r
> data <- data.frame(name = c("Root Node", "Node A", "Node B", "Leaf Node A.1", "Leaf Node A.2"), 
                     parent = c(NA, "Root Node", "Root Node", "Node A", "Node A"))
> hiervis(data, "sankey", nameField = "name", parentField = "parent", stat = "count")
```
![image](https://user-images.githubusercontent.com/516060/50473960-61756d80-09bf-11e9-8cb5-77d8541d50de.png)
