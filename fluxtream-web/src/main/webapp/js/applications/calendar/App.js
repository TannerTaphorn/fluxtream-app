define(["core/Application", "core/FlxState", "applications/calendar/Builder", "libs/bootstrap-datepicker"], function(Application, FlxState, Builder) {

	var Calendar = new Application("calendar", "Candide Kemmler", "icon-calendar");

    Calendar.currentTabName = Builder.tabs["DAY"][0];
    Calendar.currentTab = null;
    Calendar.tabState = null;
    Calendar.digest = null;
    Calendar.timeUnit = "DAY";

	var start, end;
    Calendar.connectorEnabled = {"default":{}};
    var buttons = {};

	Calendar.setup = function() {
		$(".menuNextButton").click(function(e) {
			fetchState("/nav/incrementTimespan.json?state=" + Calendar.tabState); });
		$(".menuPrevButton").click(function(e) {
			fetchState("/nav/decrementTimespan.json?state=" + Calendar.tabState); });
		$(".menuTodayButton").click(function(e) {
			Calendar.timeUnit = "DAY";
			var t = Builder.tabExistsForTimeUnit(Calendar.currentTabName, Calendar.timeUnit)?Calendar.currentTabName:Builder.tabs[Calendar.timeUnit][0];
			Calendar.currentTabName = t;
            Calendar.updateButtonStates();
			Builder.bindTimeUnitsMenu(Calendar);
			Builder.createTabs(Calendar);
			fetchState("/nav/setToToday.json");
		});
	};

	Calendar.initialize = function () {
		_.bindAll(this);

        FlxState.router.route(/^app\/calendar(\/?)(.*?)$/, "", function() {
            var parse_url = /^(?:([A-Za-z]+):)?(\/{0,3})([0-9.\-A-Za-z]+)(?::(\d+))?(?:\/([^?#]*))?(?:\?([^#]*))?(?:#(.*))?$/;
            var result = parse_url.exec(window.location.href);
            var names = [ 'url', 'scheme', 'slash', 'host', 'port', 'path' ];
            var i;
            var parts = {};
            for (i = 0; i < names.length; i += 1)
                parts[names[i]] = result[i];
            console.log("path: " + parts.path);
            var pathElements = parts.path.split("/");
            if (pathElements.length<3)
                App.invalidPath();
            var splits = {};
            var splitNames = ["app", "appName", "tabName", "timeUnit"];
            for (i = 0; i < pathElements.length; i += 1)
                splits[splitNames[i]] = pathElements[i];
            var validTab = _.include(["clock","map","diary","photos","list","timeline","dashboard"], splits.tabName),
                validTimeUnit = _.include(["date","week","month","year"], splits.timeUnit);
            if (validTab && validTimeUnit) {
                var tab = Builder.tabExistsForTimeUnit(splits.tabName, Calendar.timeUnit)?splits.tabName:Builder.tabs[Calendar.timeUnit][0];
                switch (splits.timeUnit) {
                    case "date":
                        var date = pathElements[4];
                        Calendar.render(tab + "/date/" + date);
                        break;
                    case "week":
                        var year = pathElements[4],
                            week = pathElements[5];
                        Calendar.render(tab + "/week/" + year + "/" + week);
                        break;
                    case "month":
                        var year = pathElements[4],
                            month = pathElements[5];
                        Calendar.render(tab + "/month/" + year + "/" + month);
                        break;
                    case "year":
                        var year = pathElements[4];
                        Calendar.render(tab + "/year/" + year);
                        break;
                }
            } else
                App.invalidPath();
        });
    };

	Calendar.renderState = function(state, forceReload) {
        forceReload = typeof(forceReload)!="undefined"&&forceReload;
        if (!forceReload&&FlxState.getState("calendar")===state) {
			return;
		}
		if (state==null||state==="") {
			Builder.bindTimeUnitsMenu(Calendar);
			Builder.createTabs(Calendar);
			fetchState("/nav/setToToday.json");
            return;
		}
		var splits = state.split("/");
		Calendar.currentTabName = splits[0];
        if (!Builder.isValidTabName(splits[0])) {
            App.invalidPath();
            return;
        }
        if (!Builder.isValidTimeUnit(splits[1])) {
            App.invalidPath();
            return;
        }
        Calendar.timeUnit = toTimeUnit(splits[1]);
		var nextTabState = state.substring(splits[0].length+1);
        var w = Builder.tabExistsForTimeUnit(Calendar.currentTabName, Calendar.timeUnit)?Calendar.currentTabName:Builder.tabs[Calendar.timeUnit][0];
        Calendar.currentTabName = w;
        Calendar.updateButtonStates();
        Builder.createTabs(Calendar);
        if (!forceReload&&Calendar.tabState==nextTabState) {
			// time didn't change
			Builder.updateTab(Calendar.digest, Calendar);
			FlxState.router.navigate("app/calendar/" + state);
			FlxState.saveState("calendar", state);
			return;
		} else {
            Builder.bindTimeUnitsMenu(Calendar);
            if ("DAY"===Calendar.timeUnit) {
				fetchState("/nav/setDate.json?date=" + splits[2]);
			} else if ("WEEK"===Calendar.timeUnit) {
				fetchState("/nav/setWeek.json?year=" + splits[2] + "&week=" + splits[3]);
			} else if ("MONTH"===Calendar.timeUnit) {
				fetchState("/nav/setMonth.json?year=" + splits[2] + "&month=" + splits[3]);
			} else if ("YEAR"===Calendar.timeUnit) {
				fetchState("/nav/setYear.json?year=" + splits[2]);
			}
		}
	};

	function fetchState(url) {
		$(".calendar-navigation-button").toggleClass("disabled");
		$(".loading").show();
		$("#tabs").css("opacity", ".3");
		$.ajax({ url:url,
			success : function(response) {
				if (Calendar.currentTab) {
					Calendar.currentTab.saveState();
				}
				Calendar.tabState = response.state;
                Calendar.start = response.start;
                Calendar.end  = response.end;
				FlxState.router.navigate("app/calendar/" + Calendar.currentTabName + "/" + response.state);
				FlxState.saveState("calendar", Calendar.currentTabName + "/" + response.state);
				$("#currentTimespanLabel span").html(response.currentTimespanLabel);
				if (Calendar.timeUnit==="DAY") {
					setDatepicker(response.state.split("/")[1]);
				}
                fetchCalendar("/api/calendar/all/" + response.state);
			},
			error : function() {
				alert("error");
			}
		});
	}

	function setDatepicker(currentDate) {
        $("#datepicker").replaceWith("<a data-date-format=\"yyyy-mm-dd\" id=\"datepicker\"><i class=\"icon-calendar icon-large\"></i></a>");
        $("#datepicker").attr("data-date", currentDate);
		$("#datepicker").unbind("changeDate");
		$("#datepicker").datepicker().on(
			"changeDate", function(event) {
				var curr_date = event.date.getDate();
				var curr_month = event.date.getMonth() + 1;
				var curr_year = event.date.getFullYear();
				var formatted = curr_year + "-" + curr_month + "-" + curr_date;
				fetchState("/nav/setDate.json?date=" + formatted);
				$(".datepicker").hide();
			}
		);
	}

	function fetchCalendar(url) {
		$.ajax({ url: url,
			success : function(response) {
				$("#modal").empty();
                if (Calendar.timeUnit==="DAY")
                    handleCityInfo(response);
                else
                    $("#mainCity").empty();
                Calendar.digest = response;
                enhanceDigest(Calendar.digest);
                processDigest(Calendar.digest);
				Builder.updateTab(Calendar.digest, Calendar);
				$("#tabs").css("opacity", "1");
				$(".calendar-navigation-button").toggleClass("disabled");
				$(".loading").hide();
			},
			error: function() {
				alert("error fetching calendar");
			}
		});
	}

    function enhanceDigest(digest){
        for (var templateName in digest.detailsTemplates){
            if (digest.detailsTemplates[templateName] == "")
                console.log("WARNING: " + templateName + " is using a blank details template.");
            digest.detailsTemplates[templateName] = Hogan.compile(digest.detailsTemplates[templateName]);
        }
        for (var connectorId in digest.cachedData){
            for (var i = 0; i < digest.cachedData[connectorId].length; i++){
                digest.cachedData[connectorId][i].getDetails = function(){
                    return buildDetails(digest,this);
                }
            }
        }
    }


    function processDigest(digest){
        var selectedConnectors = $("#selectedConnectors");
        selectedConnectors.empty();
        for (var i = 0; i < digest.selectedConnectors.length; i++){
            var enabled = false;
            for (var j = 0; j < digest.selectedConnectors[i].facetTypes.length && !enabled; j++){
                enabled =  digest.cachedData[digest.selectedConnectors[i].facetTypes[j]] != null;
            }
            enabled = enabled ? "" : "flx-disconnected";
            var button = $('<li><a href="#" class="flx-active ' + enabled + " " + digest.selectedConnectors[i].connectorName + '">' + digest.selectedConnectors[i].prettyName + '</button></li>');
            selectedConnectors.append(button);
            button = $(button.children()[0]);
            buttons[digest.selectedConnectors[i].connectorName] = button;
            button.click({button:button,objectTypeNames:digest.selectedConnectors[i].facetTypes,connectorName:digest.selectedConnectors[i].connectorName}, function(event){
                connectorClicked(event.data.button,event.data.objectTypeNames,event.data.connectorName);
                return false;
            });
            if (Calendar.connectorEnabled["default"][digest.selectedConnectors[i].connectorName] == null)
                Calendar.connectorEnabled["default"][digest.selectedConnectors[i].connectorName] = true;
            Calendar.updateButtonStates();
        }
    }

    Calendar.updateButtonStates = function(){
        if (Calendar.connectorEnabled[Calendar.currentTabName] == null)
            Calendar.connectorEnabled[Calendar.currentTabName] = {};
        for (var connectorName in Calendar.connectorEnabled["default"]){
            if (Calendar.connectorEnabled[Calendar.currentTabName][connectorName] == null)
                Calendar.connectorEnabled[Calendar.currentTabName][connectorName] = Calendar.connectorEnabled["default"][connectorName];
            if (Calendar.connectorEnabled[Calendar.currentTabName][connectorName]){
                buttons[connectorName].addClass("flx-active");
                buttons[connectorName].removeClass("flx-inactive")
            }
            else{
                buttons[connectorName].removeClass("flx-active");
                buttons[connectorName].addClass("flx-inactive");
            }
        }
    }

    function connectorClicked(button,objectTypeNames,connectorName){
        if (button.is(".flx-disconnected"))
            return;
        Calendar.connectorEnabled[Calendar.currentTabName][connectorName] = !Calendar.connectorEnabled[Calendar.currentTabName][connectorName];
        if (Calendar.connectorEnabled[Calendar.currentTabName][connectorName]){
            button.addClass("flx-active");
            button.removeClass("flx-inactive")
        }
        else{
            button.removeClass("flx-active");
            button.addClass("flx-inactive");
        }
        Calendar.currentTab.connectorToggled(connectorName,objectTypeNames,Calendar.connectorEnabled[Calendar.currentTabName][connectorName]);
        return;
    }



    function buildDetails(digest,data){
        if (digest.detailsTemplates[data.type] == null){
            console.log("WARNING: no template found for " + data.type + ".");
            return "";
        }
        var params = {};
        params.time = App.formatMinuteOfDay(data.startMinute);
        params.description = data.description;
        switch (data.type){
            case "lastfm-loved_track":
            case "lastfm-recent_track":
                params.imgUrl = data.imgUrls[0];
                break;
            case "twitter-mention":
                params.userName = data.userName;
                params.profileImageUrl = data.profileImageUrl;
                break;
            case "picasa-photo":
                params.photoUrl = data.photoUrl;
                break;
        }
        return digest.detailsTemplates[data.type].render(params);
    }

    function handleCityInfo(digestInfo) {
        $("#mainCity").empty();
        if (digestInfo.cities&&digestInfo.cities.length>0) {
            $("#mainCity").html(cityLabel(digestInfo.cities[0]) +
                                temperaturesLabel(digestInfo))
        }
    }

    function ephemerisLabel(digestInfo) {
        var sunriseH = Math.floor(digestInfo.solarInfo.sunrise/60);
        var sunriseM = digestInfo.solarInfo.sunrise%60;
        var sunsetH = Math.floor(digestInfo.solarInfo.sunset/60);
        var sunsetM = digestInfo.solarInfo.sunset%60;
        if (sunriseM<10) sunriseM = "0" + sunriseM;
        if (sunsetM<10) sunsetM = "0" + sunsetM;
        return "<span class=\"ephemeris\"><i class=\"flx-pict-sun\">&nbsp;</i><span>" + sunriseH + ":" + sunriseM + " am"+
               "</span>&nbsp;<i class=\"flx-pict-moon\">&nbsp;</i><span>" + sunsetH + ":" + sunsetM + " pm</span></span>";
    }

    function temperaturesLabel(digestInfo) {
        if (digestInfo.maxTempC == -10000) {
            return "";
        }
        else if (digestInfo.settings.temperatureUnit != "CELSIUS") {
            return ephemerisLabel(digestInfo) + "<i class=\"flx-pict-temp\">&nbsp;</i>"
                       + "<span class=\"ephemeris\" style=\"font-weight:normal;\">&nbsp;"
                       + digestInfo.minTempF
                       + " / "
                       + digestInfo.maxTempF
                       + "&deg;F"
                + "</span>";
        }
        else {
            return ephemerisLabel(digestInfo) + "<i class=\"flx-pict-temp\">&nbsp;</i>"
                       + "<span class=\"ephemeris\" style=\"font-weight:normal;\">&nbsp;"
                       + digestInfo.minTempC
                       + " / "
                       + digestInfo.maxTempC
                       + "&deg;C"
                + "</span>";
        }
    }

    function cityLabel(cityInfo) {
        var s = "";
        s += cityInfo.name;
        if (cityInfo.state) s += ", " + cityInfo.state;
        s += ", " + cityInfo.country;
        //if (traveling)
        //    s += " <i>- on holiday</i>";
        //if (FlxState.cities.length>20)
        //    s += " <i>- in transit</i>";
        return s;
    }

    function toTimeUnit(urlTimeUnit) {
		if (urlTimeUnit==="date") return "DAY";
		return urlTimeUnit.toUpperCase();
	}

    Calendar.dateChanged = function(date, rangeType) {
        console.log("Calendar.dateChanged(" + date + ", " + rangeType + ")");
        console.log("updating url...");

        var state = "timeline/date/" + date;
        FlxState.router.navigate("app/calendar/" + state, {trigger: false, replace: true});
        FlxState.saveState("calendar", state);
        Calendar.tabState = "date/" + date;
        Calendar.timeUnit = "DAY";

        var dateSplits = date.split("-"),
            d = new Date(Number(dateSplits[0]),Number(dateSplits[1])-1,Number(dateSplits[2]));
        var daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
        var monthsOfYear = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep",
            "Oct", "Nov", "Dec"];
        var dateLabel = daysOfWeek[d.getDay()] +
                    ", " + monthsOfYear[d.getMonth()] + " " + d.getDate() +
                    ", " + (d.getYear()+1900);
        console.log("dateLabel: " + dateLabel);

        $("#currentTimespanLabel span").html(dateLabel);
    };

	return Calendar;


});