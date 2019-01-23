#' Shiny demo for hiervis
#'
#' @param data Custom data
#' @param ... Additional arguments to hiervis()
#' @param title Title of the Shiny page
#'
#' @return Shiny app
#' @export
#' @import shiny
#'
#' @examples
#' \donttest{hiervis_demo()}
hiervis_demo <- function(data = NULL, ..., title = "hiervis demo") {
  requireNamespace("shiny")
  requireNamespace("datasets")

  dname <- deparse(substitute(data))
  ui <- pageWithSidebar(
    headerPanel(title),

    # Sidebar panel for inputs ----
    sidebarPanel(
      tags$head(
        tags$style(type="text/css", "#inline label{ display: table-cell; text-align: center; vertical-align: middle; }
                   #inline .form-group { display: table-row;}
                   #code{font-size:10px; background: ghostwhite; padding-top: 10px}")
      ),
      { if (is.null(data)) radioButtons("dataset", "Dataset:",
                                        c("Titanic (table)"="Titanic", "HairEyeColor"="HairEyeColor", "d3_modules (data.frame with path)"="d3_modules", "data.frame example with parent-child columns"="df_parentchild"), selected = "HairEyeColor") },
      radioButtons("vis", "Visualization type (parameter vis):",
                   sort(c("sankey", "sunburst", "partition", "treemap", "icicle", "vertical sankey")),
                   inline = TRUE, selected = "sankey"),
      checkboxGroupInput("cbg", "Special visualization options (parameter vis.opts)",
                         choices = c("treeColors", "showNumbers", "scaleWidth", "autoScaleSankeyDist", "linkColorChild"),
                         selected = c("treeColors", "showNumbers", "autoScaleSankeyDist")),
      #tags$div(id = "inline", textInput("numberFormat", "numberFormat: ", ",d")),
      tags$div(id = "inline", numericInput("transitionDuration", "transitionDuration: ", 350, min = 0, step = 50)),
      tags$div(id = "inline", numericInput("nodeCornerRadius", "nodeCornerRadius: ", 2, min = 0)),
      tags$div(id = "inline", numericInput("sankeyLinkOpacity", "sankeyLinkOpacity: ", .5, min = 0, max = 1, step = .05)),
      tags$div(id = "inline", numericInput("sankeyNodeSize", "sankeyNodeSize: ", 10, min = 2, step = 1)),
      tags$div(id = "inline", numericInput("sankeyAutoScaleFactor", "sankeyAutoScaleFactor: ", 100, min = 1, step = 10)),
      tags$div(id = "inline", numericInput("sankeyNodeDist", "sankeyNodeDist: ", 1, min = 0.1, step = .1)),
      tags$div(id = "inline", numericInput("textPadding", "textPadding: ", 1, min = 0.1, step = .1)),
      tags$div(id = "inline", numericInput("minText", "minText: ", 4, min = 0, step = .25)),
      tags$div()
      #checkboxInput("sunburstLabelsRadiate", "sunburstLabelsRadiate (for sunburst)", FALSE)
    ),

    # Main panel for displaying outputs ----
    mainPanel(
      fluidRow(breadcrumbOutput("breadcrumb")),
      fluidRow(hiervisOutput("hiervis"), style="padding-bottom: 20px;"),
      fluidRow(verbatimTextOutput("code"))
    )
  )

  # Define server logic to plot various variables against mpg ----
  server <- function(input, output, session) {

    rv <- reactiveValues(val="", selected=NULL)

    output$breadcrumb <- renderBreadcrumb({
        req(rv$selected)
        breadcrumb(htmlwidgets::JS(rv$selected))
    })

    observeEvent(input$hiervis_hover, {
        rv$selected <- input$hiervis_hover
    })

    observeEvent(input$hiervis_clicked, {
        rv$selected <- input$hiervis_clicked
    })

    observeEvent(input$breadcrumb_clicked, {
        # does not work
        #hiervisProxy("hiervis") %>% goUp(length(rv$selected) - input$breadcrumb_clicked)
    })

    output$hiervis <- renderHiervis({
      vis.opts = list(#numberFormat = input$numberFormat,
        transitionDuration = input$transitionDuration,
        nodeCornerRadius = input$nodeCornerRadius,
        sankeyLinkOpacity = input$sankeyLinkOpacity,
        sankeyNodeSize = input$sankeyNodeSize,
        sankeyNodeDist = input$sankeyNodeDist,
        textPadding = input$textPadding,
        minText = input$minText,
        autoScaleSankeyDist = input$autoScaleSankeyDist,
        sankeyAutoScaleFactor = input$sankeyAutoScaleFactor,
        linkColorChild = input$linkColorChild,
        #sunburstLabelsRadiate = input$sunburstLabelsRadiate,
        treeColors = FALSE, scaleWidth = FALSE,
        showNumbers = FALSE)
      vis.opts[input$cbg] <- TRUE

      prettylist <- function(l) {
        sprintf("list(%s)",
                paste(names(l), l, sep="=", collapse=", "))
      }
      prettyargs <- function(...) {
        varnames=lapply(substitute(list(...))[-1], deparse)
        prettylist(varnames)
      }

      if (is.null(data)) {
        if (input$dataset == "Titanic" || input$dataset == "") {
          call <- 'hiervis(Titanic, "%s", vis.opts = %s)'
          res <- hiervis(datasets::Titanic, input$vis, vis.opts = vis.opts)
        } else if (input$dataset == "HairEyeColor") {
          call <- 'hiervis(HairEyeColor, "%s", vis.opts = %s)'
          res <- hiervis(datasets::HairEyeColor, input$vis, vis.opts = vis.opts)
        } else if (input$dataset == "d3_modules") {
          call <-
            'hiervis(d3_modules, "%s", nameField = "path", pathSep = "/", valueField = "size", stat = "sum",
          vis.opts = %s)'
          res <- hiervis(hiervis::d3_modules, input$vis, nameField = "path", pathSep = "/", valueField = "size",
                         stat = "sum", vis.opts = vis.opts)
        } else {
          call <- 'data <- data.frame(name = c("Root Node", "Node A", "Node B", "Leaf Node A.1", "Leaf Node A.2"),
                             parent = c(NA, "Root Node", "Root Node", "Node A", "Node A"))
  hiervis(data, "%s", nameField = "name", parentField = "parent", stat = "count",
          vis.opts = %s)'

          data <- data.frame(name = c("Root Node", "Node A", "Node B", "Leaf Node A.1", "Leaf Node A.2"),
                             parent = c(NA, "Root Node", "Root Node", "Node A", "Node A"))
          res <- hiervis(data, input$vis, nameField = "name", parentField = "parent", stat = "count", vis.opts = vis.opts)
        }
      } else {
        call <- paste0('hiervis(',dname,', "%s", vis.opts = %s)')
        ## TODO: Reflect dot arguments in printed call
        res <- hiervis(data, input$vis, ..., vis.opts = vis.opts)
      }

      rv$val <- sprintf(call, input$vis, prettylist(vis.opts))
      res
    })

    output$code <- renderText({
      rv$val
    })
  }


  shinyApp(ui, server)

}
