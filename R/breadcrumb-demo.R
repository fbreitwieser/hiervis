#' @export
breadcrumb_demo <- function(trail_text = "Once upon a time I was in a forrest") {
  requireNamespace("shiny")

  ui <- pageWithSidebar(
    headerPanel("breadcrumb demo"),
    sidebarPanel(
      tags$head(
        tags$style(type="text/css", "#inline label{ display: table-cell; text-align: center; vertical-align: middle; }
                   #inline .form-group { display: table-row;}
                   #code{font-size:10px; background: ghostwhite; padding-top: 10px}")
      ),
      tags$div(id = "inline", textInput("trail", "trail", trail_text)),
      tags$div(id = "inline", numericInput("padding", "padding", 5)),
      tags$div(id = "inline", numericInput("paddingRight", "paddingRight", 35)),
      tags$div(id = "inline", numericInput("paddingArrow", "paddingArrow", 20)),
      tags$div(id = "inline", numericInput("width", "width", 130)),
      tags$div(id = "inline", numericInput("height", "height", 28)),
      tags$div(id = "inline", numericInput("top", "top", 10)),
      tags$div(id = "inline", numericInput("fontSize", "fontSize", 14)),
      tags$div(id = "inline", numericInput("marginLeft", "marginLeft", 0)),
      tags$div(id = "inline", numericInput("marginTop", "marginTop", 10)),
      tags$div(id = "inline", checkboxInput("leftDirection", "leftDirection", FALSE)),
      tags$div(id = "inline", numericInput("wrapWidth", "wrapWidth", 0))
    ),
    mainPanel(
      breadcrumbOutput("breadcrumb", height = "100px"),
      "Hovered node (breadcrumb_hover):",
      textOutput("hovered"),
      "Clicked node (breadcrumb_clicked):",
      textOutput("clicked")
    )
  )

  server <- function(input, output) {
    output$breadcrumb <- renderBreadcrumb({
      breadcrumb(lapply(strsplit(input$trail, " ")[[1]], function(x) list(text=x)),
                 opts = list(padding = input$padding,
                             paddingRight = input$paddingRight,
                             paddingArrow = input$paddingArrow,
                             width = input$width,
                             height = input$height,
                             top = input$top,
                             fontSize = input$fontSize,
                             marginLeft = input$marginLeft,
                             marginTop = input$marginTop,
                             leftDirection = input$leftDirection,
                             wrapWidth = input$wrapWidth))
    })

    output$clicked <- renderText({ input$breadcrumb_clicked })

    output$hovered <- renderText({ input$breadcrumb_hover })

  }

  shinyApp(ui, server)
}
