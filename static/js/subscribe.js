(function () {	
	//subscribe
	function subscribe_to_server () {
		var email = $("#subscribe-input").val();
		$.ajax({
			url: "https://xuechendi.us-east-2.elasticbeanstalk.com/subscribe",
			type: 'post',
			dataType: 'text',
			data: email
		}).done(function(data) {
			$("div.subscribe-block-feedback").text("Successfully subscribed!");
		});
	}
	
	function unsubscribe_to_server () {
		var email = $("#subscribe-input").val();
		$.ajax({
			url: "https://xuechendi.us-east-2.elasticbeanstalk.com/unsubscribe",
			type: 'post',
			dataType: 'text',
			data: email
		}).done(function(data) {
			$("div.subscribe-block-feedback").text("Successfully unsubscribed!");
		});
	}
	
	$("#subscribe-block-button-sub").click(function(){
		subscribe_to_server ();
	});
	
	$("#subscribe-block-button-unsub").click(function(){
		unsubscribe_to_server ();
	});
	
	$(document).ready(function(){
		$.ajax({
			url: "https://xuechendi.us-east-2.elasticbeanstalk.com/subscribe_status",
			type: 'get',
			dataType: 'text'
		}).done(function(data) {
			$("div.subscribe-block-status div").text(data);
		});
	});
})(jQuery)